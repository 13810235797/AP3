// js/shadow.js — 阴影贴图（Shadow Map）两遍渲染封装
// 第一遍：从方向光视角把场景深度写入 FBO 深度纹理；
// 第二遍：主渲染时在片元着色器里把片元光空间深度与深度纹理比较，判断是否被遮挡。

function ShadowMap(gl, size) {
    this.gl = gl;
    this.size = size;

    // 深度纹理
    this.depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
        size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 帧缓冲：只挂深度附件，不挂颜色附件
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D, this.depthTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);

    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('阴影 FBO 不完整，状态码：' + status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.lightView = mat4();
    this.lightProj = mat4();
    this.lightVP = mat4();      // 光投影 · 光观察（渲染时再乘模型矩阵）
}

// 根据方向光位置 / 目标点 / 正交范围更新光空间矩阵
ShadowMap.prototype.updateLight = function (lightPos, target, half, near, far) {
    this.lightView = lookAt(lightPos, target, [0, 1, 0]);
    this.lightProj = ortho(-half, half, -half, half, near, far);
    this.lightVP = mult(this.lightProj, this.lightView);
};

// 第一遍：绑定阴影 FBO，清空深度
ShadowMap.prototype.bindForShadow = function () {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.size, this.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
};

// 回到默认帧缓冲（画布）
ShadowMap.prototype.unbind = function (canvas) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
};

// 供主程序采样
ShadowMap.prototype.getTexture = function () { return this.depthTex; };
