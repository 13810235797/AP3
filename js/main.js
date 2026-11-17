// js/main.js — AP3 主程序
// 渲染流程：
//   第一遍（阴影）：方向光视角 → 深度写入阴影 FBO 纹理；
//   第二遍（主画面）：天空盒 → 不透明物体 → 透明物体（blend），片元内比较深度生成阴影；
//   拾取：点击时离屏渲染 ID 颜色，readPixels 反解物体并高亮、联动材质面板。

(function () {
    var canvas = document.getElementById('glcanvas');
    var gl = WebGLUtils.getWebGLContext(canvas);
    if (!gl) return;

    // ---------- 着色器程序 ----------
    var phongProg = initShadersFromSource(gl, SHADERS.phongVS, SHADERS.phongFS);
    var depthProg = initShadersFromSource(gl, SHADERS.depthVS, SHADERS.depthFS);
    var skyProg   = initShadersFromSource(gl, SHADERS.skyVS, SHADERS.skyFS);
    var pickProg  = initShadersFromSource(gl, SHADERS.pickVS, SHADERS.pickFS);

    // ---------- uniform / attribute 定位 ----------
    var P = {
        aPosition: gl.getAttribLocation(phongProg, 'aPosition'),
        aNormal: gl.getAttribLocation(phongProg, 'aNormal'),
        aTexCoord: gl.getAttribLocation(phongProg, 'aTexCoord'),
        uModelView: gl.getUniformLocation(phongProg, 'uModelView'),
        uProjection: gl.getUniformLocation(phongProg, 'uProjection'),
        uModel: gl.getUniformLocation(phongProg, 'uModel'),
        uNormalMat: gl.getUniformLocation(phongProg, 'uNormalMat'),
        uLightMVP: gl.getUniformLocation(phongProg, 'uLightMVP'),
        uLightDirEye: gl.getUniformLocation(phongProg, 'uLightDirEye'),
        uPointPosEye: gl.getUniformLocation(phongProg, 'uPointPosEye'),
        uPointOn: gl.getUniformLocation(phongProg, 'uPointOn'),
        uPointColor: gl.getUniformLocation(phongProg, 'uPointColor'),
        uWorldCamPos: gl.getUniformLocation(phongProg, 'uWorldCamPos'),
        uAmbientIntensity: gl.getUniformLocation(phongProg, 'uAmbientIntensity'),
        uDiffuseColor: gl.getUniformLocation(phongProg, 'uDiffuseColor'),
        uSpecularStrength: gl.getUniformLocation(phongProg, 'uSpecularStrength'),
        uShininess: gl.getUniformLocation(phongProg, 'uShininess'),
        uUseAmbient: gl.getUniformLocation(phongProg, 'uUseAmbient'),
        uUseDiffuse: gl.getUniformLocation(phongProg, 'uUseDiffuse'),
        uUseSpecular: gl.getUniformLocation(phongProg, 'uUseSpecular'),
        uUseTexture: gl.getUniformLocation(phongProg, 'uUseTexture'),
        uTex: gl.getUniformLocation(phongProg, 'uTex'),
        uUseEnvMap: gl.getUniformLocation(phongProg, 'uUseEnvMap'),
        uEnvMap: gl.getUniformLocation(phongProg, 'uEnvMap'),
        uReflectivity: gl.getUniformLocation(phongProg, 'uReflectivity'),
        uUseBump: gl.getUniformLocation(phongProg, 'uUseBump'),
        uBumpMap: gl.getUniformLocation(phongProg, 'uBumpMap'),
        uBumpStrength: gl.getUniformLocation(phongProg, 'uBumpStrength'),
        uOpacity: gl.getUniformLocation(phongProg, 'uOpacity'),
        uShadingModel: gl.getUniformLocation(phongProg, 'uShadingModel'),
        uHighlight: gl.getUniformLocation(phongProg, 'uHighlight'),
        uUseShadow: gl.getUniformLocation(phongProg, 'uUseShadow'),
        uDebug: gl.getUniformLocation(phongProg, 'uDebug'),
        uShadowMap: gl.getUniformLocation(phongProg, 'uShadowMap'),
        uBias: gl.getUniformLocation(phongProg, 'uBias'),
        uShadowTexel: gl.getUniformLocation(phongProg, 'uShadowTexel'),
        uShadowPCF: gl.getUniformLocation(phongProg, 'uShadowPCF')
    };

    var D = {
        aPosition: gl.getAttribLocation(depthProg, 'aPosition'),
        uModel: gl.getUniformLocation(depthProg, 'uModel'),
        uLightMVP: gl.getUniformLocation(depthProg, 'uLightMVP')
    };

    var S = {
        aPosition: gl.getAttribLocation(skyProg, 'aPosition'),
        uProjection: gl.getUniformLocation(skyProg, 'uProjection'),
        uView: gl.getUniformLocation(skyProg, 'uView'),
        uEnvMap: gl.getUniformLocation(skyProg, 'uEnvMap')
    };

    var K = {
        aPosition: gl.getAttribLocation(pickProg, 'aPosition'),
        uMVP: gl.getUniformLocation(pickProg, 'uMVP'),
        uPickColor: gl.getUniformLocation(pickProg, 'uPickColor')
    };

    // ---------- 几何缓冲 ----------
    function makeBuffers(geo) {
        var b = {};
        b.pos = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
        gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
        if (geo.normals) {
            b.nor = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
            gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
        }
        if (geo.texCoords) {
            b.tex = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b.tex);
            gl.bufferData(gl.ARRAY_BUFFER, geo.texCoords, gl.STATIC_DRAW);
        }
        b.idx = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
        b.count = geo.indices.length;
        return b;
    }

    var geoSphere = makeBuffers(createSphere(32, 48));
    var geoBox    = makeBuffers(createBox(1, 1, 1));
    var skyGeo    = createSkyBox(2);
    var skyPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyPos);
    gl.bufferData(gl.ARRAY_BUFFER, skyGeo.positions, gl.STATIC_DRAW);
    var skyIdx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, skyGeo.indices, gl.STATIC_DRAW);

    function buffersFor(obj) {
        if (obj.geo === 'sphere') return geoSphere;
        return geoBox;
    }

    // ---------- 纹理 ----------
    var TEX = {};
    TEX.checker = uploadTexture2D(gl, makeCheckerTexture());
    TEX.wood    = uploadTexture2D(gl, makeWoodTexture());
    TEX.bump    = uploadTexture2D(gl, makeBrickBumpTexture());
    TEX.env     = uploadCubemap(gl, makeEnvFaces());

    // 默认占位纹理：未使用的采样单元绑定同类型占位，避免残留异类纹理引发类型冲突
    function makeWhite2D() {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
    }
    function makeWhiteCube() {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
        var px = new Uint8Array([255, 255, 255, 255]);
        for (var i = 0; i < 6; i++) {
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, 1, 1, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, px);
        }
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
    }
    TEX.white2D = makeWhite2D();
    TEX.whiteCube = makeWhiteCube();

    // ---------- 阴影贴图 / 拾取缓冲 ----------
    var shadow = new ShadowMap(gl, 1024);
    var pick = new PickBuffer(gl, canvas.width || 640, canvas.height || 480);

    // ---------- 运行状态 ----------
    function queryFlag(name, def) {
        var m = new RegExp('[?&]' + name + '=([01])').exec(location.search);
        return m ? m[1] === '1' : def;
    }
    var state = {
        ambient: 0.25,
        useAmbient: queryFlag('ambient', true),
        useDiffuse: queryFlag('diffuse', true),
        useSpecular: queryFlag('specular', true),
        dirOn: true, pointOn: true,
        shadowOn: true, bias: 0.004, pcf: 1.0, half: 7.0,
        sky: true, wire: false, bumpEnabled: true,
        debug: 0,
        selected: null
    };

    var camera = new Camera(canvas);
    var hud = document.getElementById('hud');
    initUI(state, camera);
    state.syncControls();

    // URL 姿态参数（调试 / 截图用）：?az=0&el=0.5&dist=11
    function queryNum(name, def) {
        var m = new RegExp('[?&]' + name + '=([-0-9.]+)').exec(location.search);
        return m ? parseFloat(m[1]) : def;
    }
    camera.setPose(queryNum('az', 0), queryNum('el', 0), queryNum('dist', 10));
    state.debug = queryNum('debug', 0);

    // URL ?select=<id>：初始选中指定物体（拾取演示截图用）
    var selId = queryNum('select', 0);
    if (selId > 0) {
        SCENE.objects.forEach(function (o) { if (o.id === selId) state.selected = o; });
        state.refreshPanel();
    }
    // URL ?uvd=1：铺满输出木箱 UV 展开示意图（README 配图导出用）
    if (queryNum('uvd', 0) === 1) {
        var uvCanvas = makeUVDiagram();
        uvCanvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid #333;';
        document.body.appendChild(uvCanvas);
        document.getElementById('panel').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('tips').style.display = 'none';
    }

    // ---------- 矩阵工具 ----------
    function modelMatrix(obj) {
        var m = translate(obj.pos);
        m = mult(m, scale(obj.size));
        return m;
    }
    function normalMat3(mv) {
        return [
            [mv[0], mv[1], mv[2]],
            [mv[4], mv[5], mv[6]],
            [mv[8], mv[9], mv[10]]
        ];
    }

    var view = mat4(), proj = mat4();
    var lightVP = mat4();

    // ---------- 绑定主程序几何属性 ----------
    function bindPhongAttribs(b) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
        gl.enableVertexAttribArray(P.aPosition);
        gl.vertexAttribPointer(P.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
        gl.enableVertexAttribArray(P.aNormal);
        gl.vertexAttribPointer(P.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.tex);
        gl.enableVertexAttribArray(P.aTexCoord);
        gl.vertexAttribPointer(P.aTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    }

    // ---------- 第一遍：阴影深度 ----------
    function renderShadowPass() {
        shadow.bindForShadow();
        gl.useProgram(depthProg);
        gl.enable(gl.DEPTH_TEST);
        SCENE.objects.forEach(function (obj) {
            if (!obj.castShadow) return;
            var model = modelMatrix(obj);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffersFor(obj).pos);
            gl.enableVertexAttribArray(D.aPosition);
            gl.vertexAttribPointer(D.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersFor(obj).idx);
            gl.uniformMatrix4fv(D.uModel, false, flatten(model));
            gl.uniformMatrix4fv(D.uLightMVP, false, flatten(lightVP));
            gl.drawElements(gl.TRIANGLES, buffersFor(obj).count, gl.UNSIGNED_SHORT, 0);
        });
        shadow.unbind(canvas);
    }

    // ---------- 绘制单个物体（主程序）----------
    function drawObject(obj, eye) {
        var mat = obj.mat;
        var model = modelMatrix(obj);
        var mv = mult(view, model);
        var b = buffersFor(obj);

        gl.useProgram(phongProg);
        bindPhongAttribs(b);

        gl.uniformMatrix4fv(P.uModelView, false, flatten(mv));
        gl.uniformMatrix4fv(P.uProjection, false, flatten(proj));
        gl.uniformMatrix4fv(P.uModel, false, flatten(model));
        gl.uniformMatrix3fv(P.uNormalMat, false, flatten(normalMat3(mv)));
        gl.uniformMatrix4fv(P.uLightMVP, false, flatten(lightVP));

        // 光源（观察系）
        var dirWorld = normalize(subtract(SCENE.lights.dir.target, SCENE.lights.dir.pos));
        var dirEye = normalize(mult(view, [dirWorld[0], dirWorld[1], dirWorld[2], 0]).slice(0, 3));
        gl.uniform3fv(P.uLightDirEye, state.dirOn ? dirEye : [0, -1, 0]);
        var ptEye = mult(view, SCENE.lights.point.pos.concat([1])).slice(0, 3);
        gl.uniform3fv(P.uPointPosEye, ptEye);
        gl.uniform1i(P.uPointOn, (state.pointOn && !mat.emissive) ? 1 : 0);
        gl.uniform3fv(P.uPointColor, SCENE.lights.point.color);
        gl.uniform3fv(P.uWorldCamPos, eye);

        // Phong 三分量
        gl.uniform1f(P.uAmbientIntensity, state.ambient);
        gl.uniform3fv(P.uDiffuseColor, mat.diffuse);
        gl.uniform1f(P.uSpecularStrength, mat.specular);
        gl.uniform1f(P.uShininess, mat.shininess);
        gl.uniform1i(P.uUseAmbient, state.useAmbient ? 1 : 0);
        gl.uniform1i(P.uUseDiffuse, state.useDiffuse ? 1 : 0);
        gl.uniform1i(P.uUseSpecular, state.useSpecular ? 1 : 0);

        // 纹理 / 反射 / 凹凸：每个采样单元显式绑定，未使用时绑同类型占位纹理
        gl.uniform1i(P.uTex, 0);
        gl.uniform1i(P.uEnvMap, 1);
        gl.uniform1i(P.uBumpMap, 2);
        gl.uniform1i(P.uShadowMap, 3);

        gl.uniform1i(P.uUseTexture, mat.useTexture ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mat.useTexture ? TEX[mat.tex] : TEX.white2D);

        gl.uniform1i(P.uUseEnvMap, mat.useEnv ? 1 : 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, mat.useEnv ? TEX.env : TEX.whiteCube);
        gl.uniform1f(P.uReflectivity, mat.reflectivity || 0);

        gl.uniform1i(P.uUseBump, (mat.useBump && state.bumpEnabled) ? 1 : 0);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, mat.useBump ? TEX.bump : TEX.white2D);
        gl.uniform1f(P.uBumpStrength, mat.bumpStrength);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, shadow.getTexture());

        // 阴影
        gl.uniform1i(P.uUseShadow, (state.shadowOn && obj.receiveShadow) ? 1 : 0);
        gl.uniform1f(P.uBias, state.bias);
        gl.uniform1f(P.uShadowTexel, 1 / shadow.size);
        gl.uniform1f(P.uShadowPCF, state.pcf);

        // 其余状态
        gl.uniform1f(P.uOpacity, mat.opacity);
        gl.uniform1i(P.uShadingModel, mat.shading);
        gl.uniform1i(P.uHighlight, (state.selected === obj) ? 1 : 0);
        gl.uniform1i(P.uDebug, state.debug);

        var mode = state.wire ? gl.LINES : gl.TRIANGLES;
        gl.drawElements(mode, b.count, gl.UNSIGNED_SHORT, 0);
    }

    // ---------- 天空盒 ----------
    function drawSkybox() {
        gl.useProgram(skyProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, skyPos);
        gl.enableVertexAttribArray(S.aPosition);
        gl.vertexAttribPointer(S.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIdx);
        var viewRot = view.slice();
        viewRot[12] = viewRot[13] = viewRot[14] = 0;   // 去掉平移
        gl.uniformMatrix4fv(S.uProjection, false, flatten(proj));
        gl.uniformMatrix4fv(S.uView, false, flatten(viewRot));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, TEX.env);
        gl.uniform1i(S.uEnvMap, 1);
        gl.depthFunc(gl.LEQUAL);
        gl.drawElements(gl.TRIANGLES, skyGeo.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.depthFunc(gl.LESS);
    }

    // ---------- 主循环 ----------
    function frame() {
        WebGLUtils.resize(canvas);
        if (pick.width !== canvas.width || pick.height !== canvas.height) {
            pick.resize(canvas.width, canvas.height);
        }

        var cam = camera.update();
        view = lookAt(cam.eye, camera.target, cam.up);
        var aspect = canvas.width / canvas.height;
        proj = perspective(50, aspect, 0.1, 100);

        // 更新阴影光空间矩阵
        shadow.updateLight(SCENE.lights.dir.pos, SCENE.lights.dir.target,
            state.half, SCENE.lights.dir.near, SCENE.lights.dir.far);
        lightVP = shadow.lightVP;

        // 第一遍：阴影深度
        renderShadowPass();

        // 第二遍：主画面
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.07, 0.09, 0.13, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.depthMask(true);

        if (state.sky) drawSkybox();

        // 不透明物体
        SCENE.objects.forEach(function (obj) {
            if (obj.transparent) return;
            drawObject(obj, cam.eye);
        });
        // 透明物体（混合，关闭深度写入）
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        SCENE.objects.forEach(function (obj) {
            if (!obj.transparent) return;
            drawObject(obj, cam.eye);
        });
        gl.depthMask(true);
        gl.disable(gl.BLEND);

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---------- 颜色编码拾取 ----------
    canvas.addEventListener('click', function (e) {
        if (camera.wasDragged()) return;       // 拖拽旋转不触发拾取
        var rect = canvas.getBoundingClientRect();
        var x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
        var y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

        pick.begin();
        gl.useProgram(pickProg);
        SCENE.objects.forEach(function (obj) {
            if (!obj.pickable) return;
            var model = modelMatrix(obj);
            var b = buffersFor(obj);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
            gl.enableVertexAttribArray(K.aPosition);
            gl.vertexAttribPointer(K.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
            gl.uniformMatrix4fv(K.uMVP, false, flatten(mult(proj, mult(view, model))));
            gl.uniform3fv(K.uPickColor, pick.encode(obj.id));
            gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
        });
        pick.unbind(canvas);

        var id = pick.readId(x, y);
        var hit = null;
        SCENE.objects.forEach(function (obj) { if (obj.id === id) hit = obj; });
        state.selected = hit;
        state.refreshPanel();
        hud.textContent = hit ? ('已选中：' + hit.name + '（面板可调其材质）')
                              : '未选中物体（点击空白处取消）';
    });
})();
