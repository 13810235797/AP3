// js/pick.js — 颜色编码拾取（教材 3.9 拾取思想的离屏实现）
// 做法：把每个可拾取物体渲染成一个编码其 ID 的纯色，写入离屏 FBO；
// 点击位置 readPixels 读回颜色，反解出物体 ID。背景 ID=0。

function PickBuffer(gl, width, height) {
    this.gl = gl;
    this.width = width;
    this.height = height;

    // 颜色纹理（存 ID 编码色）
    this.colorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 深度渲染缓冲（保证遮挡关系与主画面一致）
    this.depthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, this.colorTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER, this.depthRb);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('拾取 FBO 不完整');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

PickBuffer.prototype.resize = function (width, height) {
    this.width = width; this.height = height;
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
};

// ID → RGB 颜色（id 从 1 开始；0 为背景）
PickBuffer.prototype.encode = function (id) {
    return [
        (id & 0xFF) / 255,
        ((id >> 8) & 0xFF) / 255,
        ((id >> 16) & 0xFF) / 255
    ];
};

PickBuffer.prototype.begin = function () {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

PickBuffer.prototype.unbind = function (canvas) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
};

// 读回点击位置的物体 ID（client 坐标 x,y 已相对 canvas）
PickBuffer.prototype.readId = function (x, y) {
    var gl = this.gl;
    var py = this.height - 1 - y;       // readPixels 原点在左下
    var px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.readPixels(x, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px[0] | (px[1] << 8) | (px[2] << 16);
};
