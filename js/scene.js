// js/scene.js — 场景配置：光源 + 物体（几何 / 位置 / 材质）集中管理
// 坐标系：Y 向上，地面 y=0；房间范围 X/Z ∈ [-5.5, 5.5]。

var SCENE = {

    // ---------- 光源 ----------
    lights: {
        // 方向光（带阴影贴图）：从斜上方照射
        dir: {
            on: true,
            color: [1.0, 0.96, 0.88],
            intensity: 1.0,
            pos: [6.0, 9.0, 4.0],        // 光相机位置（世界系）
            target: [0.0, 0.0, 0.0],
            half: 7.0,                    // 正交阴影相机半范围（面板可调）
            near: 1.0,
            far: 25.0
        },
        // 点光源（带距离衰减，不投射阴影）
        point: {
            on: true,
            color: [0.65, 0.82, 1.0],
            intensity: 1.0,
            pos: [2.6, 3.0, 2.2]
        }
    },

    // ---------- 物体 ----------
    // geo: sphere / box / plane / skybox
    // mat: diffuse 漫反射颜色, specular 镜面强度, shininess 高光指数, opacity 透明度,
    //      useTexture 位图纹理, tex 纹理键, useEnv 环境反射, reflectivity 反射率,
    //      useBump 凹凸贴图, bumpStrength 凹凸强度, shading 0 Phong / 1 Blinn-Phong / 2 Toon
    objects: [
        {
            id: 1, key: 'floor', name: '地面（棋盘纹理）',
            geo: 'box', size: [12, 0.02, 12], pos: [0, -0.01, 0],
            mat: { diffuse: [0.72, 0.70, 0.64], specular: 0.05, shininess: 8, opacity: 1,
                   useTexture: true, tex: 'checker', useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: false, receiveShadow: true, pickable: false
        },
        {
            id: 2, key: 'backwall', name: '后墙',
            geo: 'box', size: [12, 5, 0.1], pos: [0, 2.5, -5.5],
            mat: { diffuse: [0.82, 0.80, 0.76], specular: 0.03, shininess: 6, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: false, receiveShadow: true, pickable: false
        },
        {
            id: 3, key: 'crate', name: '木箱（位图纹理）',
            geo: 'box', size: [1.1, 1.1, 1.1], pos: [-2.3, 0.55, -0.6],
            mat: { diffuse: [0.9, 0.7, 0.45], specular: 0.25, shininess: 16, opacity: 1,
                   useTexture: true, tex: 'wood', useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: true, receiveShadow: true, pickable: true
        },
        {
            id: 4, key: 'mirror', name: '反射球（环境贴图）',
            geo: 'sphere', size: [0.75, 0.75, 0.75], pos: [0.2, 0.75, 0.9],
            mat: { diffuse: [0.6, 0.6, 0.62], specular: 0.6, shininess: 64, opacity: 1,
                   useTexture: false, tex: null, useEnv: true, reflectivity: 0.92,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: true, receiveShadow: false, pickable: true
        },
        {
            id: 5, key: 'phongball', name: 'Phong 球（纯色）',
            geo: 'sphere', size: [0.6, 0.6, 0.6], pos: [2.7, 0.6, 0.1],
            mat: { diffuse: [0.75, 0.18, 0.18], specular: 0.5, shininess: 32, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: true, receiveShadow: true, pickable: true
        },
        {
            id: 6, key: 'glass', name: '玻璃球（透明混合）',
            geo: 'sphere', size: [0.55, 0.55, 0.55], pos: [-1.3, 0.55, 1.9],
            mat: { diffuse: [0.4, 0.8, 0.85], specular: 0.4, shininess: 48, opacity: 0.45,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0 },
            castShadow: false, receiveShadow: false, pickable: true, transparent: true
        },
        {
            id: 7, key: 'bumpbox', name: '砖墙（凹凸贴图）',
            geo: 'box', size: [0.9, 0.9, 0.9], pos: [1.7, 0.45, 1.8],
            mat: { diffuse: [0.7, 0.5, 0.42], specular: 0.15, shininess: 12, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: true, bumpStrength: 2.0, shading: 0 },
            castShadow: true, receiveShadow: true, pickable: true
        },
        {
            id: 8, key: 'toon', name: '卡通盒（Toon 着色）',
            geo: 'box', size: [0.8, 0.8, 0.8], pos: [3.2, 0.4, 1.5],
            mat: { diffuse: [0.3, 0.65, 0.35], specular: 0.2, shininess: 24, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 2 },
            castShadow: true, receiveShadow: true, pickable: true
        },
        {
            id: 9, key: 'blinn', name: 'Blinn-Phong 球',
            geo: 'sphere', size: [0.5, 0.5, 0.5], pos: [-3.1, 0.5, 1.3],
            mat: { diffuse: [0.3, 0.45, 0.8], specular: 0.55, shininess: 32, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 1 },
            castShadow: true, receiveShadow: true, pickable: true
        },
        {
            id: 10, key: 'bulb', name: '点光源（自发光）',
            geo: 'sphere', size: [0.18, 0.18, 0.18], pos: [0, 0, 0],
            mat: { diffuse: [1.0, 0.9, 0.5], specular: 0.0, shininess: 8, opacity: 1,
                   useTexture: false, tex: null, useEnv: false, reflectivity: 0,
                   useBump: false, bumpStrength: 1.0, shading: 0, emissive: true },
            castShadow: false, receiveShadow: false, pickable: false
        }
    ]
};

// 点光源小球位置跟随点光配置（避免上面占位符写两遍）
SCENE.objects[9].pos = SCENE.lights.point.pos.slice();
