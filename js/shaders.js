// js/shaders.js — AP3 光照与纹理场景全部着色器源码（GLSL ES 1.00，WebGL2 向下兼容）
// 程序清单：
//   1) phongProgram  —— 主着色器：手写 Phong（环境/漫反射/镜面三分量），
//                       支持 2D 位图纹理、cubemap 环境反射、阴影贴图、凹凸贴图、
//                       透明混合、Phong / Blinn-Phong / Toon 三种着色模型、选中高亮。
//   2) depthProgram  —— 阴影第一遍：只把场景深度写入 FBO 深度纹理。
//   3) skyboxProgram —— 天空盒：用同一套 cubemap 绘制场景背景。
//   4) pickProgram   —— 颜色编码拾取：每个物体渲染成一个编码 ID 的纯色。

var SHADERS = {};

// ==========================================================================
// 1) 主 Phong 程序
// ==========================================================================
SHADERS.phongVS = `
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelView;   // 观察 · 模型
uniform mat4 uProjection;
uniform mat4 uModel;       // 纯模型矩阵（世界系，供阴影 / 环境反射使用）
uniform mat3 uNormalMat;   // 法线的观察系变换
uniform mat4 uLightMVP;    // 光空间投影 · 光观察 · 模型（阴影贴图用）

varying vec2  vTexCoord;
varying vec3  vNormalEye;
varying vec3  vPosEye;
varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec4  vLightPos;

void main() {
    vTexCoord = aTexCoord;

    vec4 world = uModel * aPosition;
    vWorldPos    = world.xyz;
    vWorldNormal = mat3(uModel) * aNormal;

    vec4 eye = uModelView * aPosition;
    vPosEye      = eye.xyz;
    vNormalEye   = normalize(uNormalMat * aNormal);

    vLightPos = uLightMVP * world;
    gl_Position = uProjection * eye;
}
`;

SHADERS.phongFS = `
precision mediump float;

// ---- 纹理 / 贴图 ----
uniform sampler2D   uTex;        // 普通位图纹理
uniform samplerCube uEnvMap;     // 立方体环境贴图（反射）
uniform sampler2D   uBumpMap;    // 凹凸贴图（灰度高度）
uniform sampler2D   uShadowMap;  // 阴影深度纹理

// ---- Phong 三分量开关 ----
uniform int  uUseAmbient;
uniform int  uUseDiffuse;
uniform int  uUseSpecular;

// ---- Phong 材质 / 光照参数（面板可调）----
uniform float uAmbientIntensity; // 环境光强度
uniform vec3  uDiffuseColor;     // 漫反射颜色
uniform float uSpecularStrength;  // 镜面强度
uniform float uShininess;         // 高光指数（Phong 幂次）

// ---- 光源（观察系）----
uniform vec3  uLightDirEye;       // 方向光：指向光源的方向（观察系，归一化）
uniform vec3  uPointPosEye;     // 点光源位置（观察系）
uniform int   uPointOn;          // 点光开关
uniform vec3  uPointColor;
uniform vec3  uWorldCamPos;       // 相机世界坐标（环境反射用）

// ---- 功能开关 ----
uniform int   uUseTexture;       // 采样 2D 纹理作为漫反射基色
uniform int   uUseEnvMap;        // 启用 cubemap 反射
uniform float uReflectivity;     // 反射率 0~1
uniform int   uUseBump;           // 启用凹凸扰动
uniform float uBumpStrength;
uniform float uOpacity;          // 透明度（1=不透明）
uniform int   uShadingModel;     // 0=Phong  1=Blinn-Phong  2=Toon
uniform int   uHighlight;        // 选中高亮（变色）
uniform int   uUseShadow;        // 启用阴影贴图
uniform int   uDebug;            // 1=输出 UV 坐标可视化（调试）

// ---- 阴影参数（面板可调）----
uniform float uBias;              // 深度偏移，抑制漏光
uniform float uShadowTexel;      // 阴影贴图分辨率（texel = 1/分辨率）
uniform float uShadowPCF;        // PCF 采样半径（texel 倍数）

varying vec2  vTexCoord;
varying vec3  vNormalEye;
varying vec3  vPosEye;
varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec4  vLightPos;

// 阴影系数：1.0 = 完全受光，0.0 = 全影
float shadowFactor() {
    if (uUseShadow == 0) return 1.0;
    vec3 proj = vLightPos.xyz / vLightPos.w;
    proj = proj * 0.5 + 0.5;
    if (proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;
    if (proj.z > 1.0) return 1.0;

    float bias = uBias;
    vec2 texel = vec2(uShadowTexel) * uShadowPCF;
    float sum = 0.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            float d = texture2D(uShadowMap, proj.xy + vec2(float(x), float(y)) * texel).r;
            sum += (proj.z - bias > d) ? 1.0 : 0.0;
        }
    }
    float blocked = sum / 9.0;
    return 1.0 - blocked;
}

// Toon 卡通着色：漫反射量化成 4 档硬边
float toonBand(float d) {
    if (d > 0.75) return 1.00;
    if (d > 0.50) return 0.70;
    if (d > 0.25) return 0.40;
    return 0.15;
}

void main() {
    if (uDebug == 1) {
        gl_FragColor = vec4(mod(vTexCoord, 1.0), 0.0, 1.0);
        return;
    }
    if (uDebug == 2) {
        vec3 lp = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
        float d = texture2D(uShadowMap, lp.xy).r;
        gl_FragColor = vec4(d, d, d, 1.0);
        return;
    }
    if (uDebug == 3) {
        float sf = shadowFactor();
        gl_FragColor = vec4(vec3(sf), 1.0);
        return;
    }
    if (uDebug == 4) {
        vec3 lp = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
        gl_FragColor = vec4(lp.xy, 0.0, 1.0);
        return;
    }
    // ---------- 基色 ----------
    vec3 baseColor = uDiffuseColor;
    if (uUseTexture == 1) {
        baseColor = texture2D(uTex, vTexCoord).rgb;
    }

    // ---------- 法线 ----------
    vec3 N = normalize(vNormalEye);
    vec3 Nworld = normalize(vWorldNormal);

    // 凹凸贴图：用灰度高度沿 UV 两个方向的差分扰动法线（简化切线扰动）
    if (uUseBump == 1) {
        float h  = texture2D(uBumpMap, vTexCoord).r;
        float hx = texture2D(uBumpMap, vTexCoord + vec2(0.012, 0.0)).r;
        float hy = texture2D(uBumpMap, vTexCoord + vec2(0.0, 0.012)).r;
        N = normalize(N + vec3((h - hx), (h - hy), 0.0) * uBumpStrength);
    }

    vec3 V = normalize(-vPosEye);                 // 观察方向（观察系）
    vec3 Vworld = normalize(uWorldCamPos - vWorldPos);

    // ---------- 方向光 ----------
    vec3 L1 = normalize(uLightDirEye);
    float ndl1 = max(dot(N, L1), 0.0);

    // ---------- 点光（带距离衰减）--------
    vec3 L2 = vec3(0.0);
    float ndl2 = 0.0;
    float atten2 = 0.0;
    if (uPointOn == 1) {
        vec3 d2 = uPointPosEye - vPosEye;
        float dist = length(d2);
        L2 = normalize(d2);
        ndl2 = max(dot(N, L2), 0.0);
        atten2 = 1.0 / (1.0 + 0.08 * dist + 0.04 * dist * dist);
    }

    // ---------- 漫反射项（按着色模型）----------
    float diff1 = ndl1;
    float diff2 = ndl2;
    if (uShadingModel == 2) {           // Toon
        diff1 = toonBand(ndl1);
        diff2 = toonBand(ndl2);
    }

    // ---------- 镜面项（Phong / Blinn-Phong）----------
    vec3 specColor = vec3(0.0);
    if (uUseSpecular == 1) {
        float spec1 = 0.0, spec2 = 0.0;
        if (uShadingModel == 1) {      // Blinn-Phong：半程向量
            vec3 H1 = normalize(L1 + V);
            spec1 = pow(max(dot(N, H1), 0.0), uShininess);
            if (uPointOn == 1) {
                vec3 H2 = normalize(L2 + V);
                spec2 = pow(max(dot(N, H2), 0.0), uShininess) * atten2;
            }
        } else {                        // Phong：反射向量（Toon 也走硬边反射）
            vec3 R1 = reflect(-L1, N);
            spec1 = pow(max(dot(R1, V), 0.0), uShininess);
            if (uPointOn == 1) {
                vec3 R2 = reflect(-L2, N);
                spec2 = pow(max(dot(R2, V), 0.0), uShininess) * atten2;
            }
        }
        specColor = vec3(1.0) * uSpecularStrength * (spec1 + spec2);
    }

    // ---------- 合成光照 ----------
    float shadow = shadowFactor();

    vec3 ambient = vec3(0.0);
    if (uUseAmbient == 1) {
        ambient = baseColor * uAmbientIntensity;
    }

    vec3 diffuse = vec3(0.0);
    if (uUseDiffuse == 1) {
        diffuse = baseColor * (diff1 * shadow + diff2 * atten2) * vec3(1.0);
    }

    vec3 lit = ambient + diffuse + specColor;

    // ---------- 环境贴图反射（世界系反射向量采样 cubemap）----------
    if (uUseEnvMap == 1) {
        vec3 Rw = reflect(-Vworld, Nworld);
        vec3 envColor = textureCube(uEnvMap, Rw).rgb;
        lit = mix(lit, envColor, uReflectivity);
    }

    // ---------- 选中高亮：整体向亮金色偏移并轻微自发光 ----------
    if (uHighlight == 1) {
        lit = mix(lit, vec3(1.0, 0.85, 0.25), 0.45) + vec3(0.12);
    }

    gl_FragColor = vec4(lit, uOpacity);
}
`;

// ==========================================================================
// 2) 阴影第一遍：深度程序（FBO 只挂深度纹理，不写颜色）
// ==========================================================================
SHADERS.depthVS = `
attribute vec4 aPosition;
uniform mat4 uModel;
uniform mat4 uLightMVP;
void main() {
    gl_Position = uLightMVP * uModel * aPosition;
}
`;

SHADERS.depthFS = `
precision mediump float;
void main() {
    gl_FragColor = vec4(1.0);
}
`;

// ==========================================================================
// 3) 天空盒程序：cubemap 背景
// ==========================================================================
SHADERS.skyVS = `
attribute vec4 aPosition;
uniform mat4 uProjection;
uniform mat4 uView;
varying vec3 vWorldDir;
void main() {
    vWorldDir = aPosition.xyz;
    vec4 p = uProjection * uView * aPosition;
    // 把天空盒推到远平面：取齐次坐标的 w，强制 z/w = 1
    gl_Position = vec4(p.xy, p.w, p.w);
}
`;

SHADERS.skyFS = `
precision mediump float;
uniform samplerCube uEnvMap;
varying vec3 vWorldDir;
void main() {
    gl_FragColor = textureCube(uEnvMap, normalize(vWorldDir));
}
`;

// ==========================================================================
// 4) 颜色编码拾取程序：物体渲染成 ID 纯色，离屏读回解码
// ==========================================================================
SHADERS.pickVS = `
attribute vec4 aPosition;
uniform mat4 uMVP;
void main() {
    gl_Position = uMVP * aPosition;
}
`;

SHADERS.pickFS = `
precision mediump float;
uniform vec3 uPickColor;
void main() {
    gl_FragColor = vec4(uPickColor, 1.0);
}
`;
