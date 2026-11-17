// js/textures.js — 程序化位图纹理 + 立方体环境贴图 + 凹凸贴图 + UV 展开示意
// 说明：不依赖外部图片，全部由 <canvas> 运行时绘制，再经 gl.texImage2D /
//       gl.texImage2D(TEXTURE_CUBE_MAP_*) 上传为 GPU 纹理。

// 确定性伪随机（每次刷新结果一致）
function makeRng(seed) {
    var s = seed;
    return function () {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}

function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

// ---------- 木箱木纹（普通位图纹理，AP3 第 3 项，配合 UV 讲解）----------
function makeWoodTexture() {
    var w = 512, h = 512;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    var rng = makeRng(20261117);

    // 基底木色
    ctx.fillStyle = '#9c6b3c';
    ctx.fillRect(0, 0, w, h);

    // 横向木板：4 块板，板缝深色
    var planks = 4;
    for (var p = 0; p < planks; p++) {
        var y0 = (p / planks) * h;
        var bh = h / planks;
        var shade = 0.85 + rng() * 0.3;
        ctx.fillStyle = 'rgb(' + Math.floor(156 * shade) + ',' +
                                 Math.floor(107 * shade) + ',' +
                                 Math.floor(60 * shade) + ')';
        ctx.fillRect(0, y0, w, bh);
        // 木纹细丝
        for (var i = 0; i < 28; i++) {
            var yy = y0 + rng() * bh;
            ctx.strokeStyle = 'rgba(70,42,18,' + (0.15 + rng() * 0.25) + ')';
            ctx.lineWidth = 1 + rng() * 1.5;
            ctx.beginPath();
            ctx.moveTo(0, yy);
            for (var x = 0; x <= w; x += 32) {
                ctx.lineTo(x, yy + Math.sin(x * 0.03 + rng() * 6) * 3);
            }
            ctx.stroke();
        }
        // 板缝
        ctx.fillStyle = 'rgba(40,22,10,0.85)';
        ctx.fillRect(0, y0, w, 3);
        // 铁钉
        ctx.fillStyle = 'rgba(50,30,15,0.9)';
        [[28, y0 + bh / 2], [w - 28, y0 + bh / 2]].forEach(function (pt) {
            ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2); ctx.fill();
        });
    }
    return c;
}

// ---------- 地面棋盘格 ----------
function makeCheckerTexture() {
    var w = 512, h = 512;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    var n = 8;
    var s = w / n;
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
            ctx.fillStyle = ((i + j) % 2 === 0) ? '#b8b0a0' : '#8f8878';
            ctx.fillRect(i * s, j * s, s, s);
        }
    }
    // 轻微噪点
    var rng = makeRng(5);
    for (var k = 0; k < 1500; k++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (rng() * 0.06) + ')';
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
    return c;
}

// ---------- 砖墙凹凸贴图（灰度高度图，E1 bump 对比）----------
function makeBrickBumpTexture() {
    var w = 512, h = 512;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3a3a';              // 砖缝（低）
    ctx.fillRect(0, 0, w, h);
    var rows = 8, bh = h / rows, bw = w / 4;
    for (var r = 0; r < rows; r++) {
        var off = (r % 2) * bw / 2;
        for (var col = -1; col < 5; col++) {
            var x = col * bw + off;
            var g = 150 + Math.floor(Math.random() * 60);
            ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
            ctx.fillRect(x + 4, r * bh + 4, bw - 8, bh - 8);
        }
    }
    return c;
}

// ---------- 立方体环境贴图：单张面（6 面连贯的程序化天空 / 城市剪影）----------
// face: 0=+X 1=-X 2=+Y(顶) 3=-Y(底) 4=+Z 5=-Z
function makeEnvFace(face) {
    var w = 256, h = 256;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    var rng = makeRng(100 + face);

    if (face === 2) {                       // 顶面：蓝天渐变
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2a5fa8'); g.addColorStop(1, '#7db8e8');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        return c;
    }
    if (face === 3) {                       // 底面：地面灰绿
        ctx.fillStyle = '#5a6a4a'; ctx.fillRect(0, 0, w, h);
        return c;
    }

    // 四周立面：上半天空，下半暖色地平线 + 楼块剪影
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3a78c0');
    sky.addColorStop(0.55, '#9ecfec');
    sky.addColorStop(0.72, '#f6d9a0');
    sky.addColorStop(1, '#e8a86a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    // 太阳
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.beginPath(); ctx.arc(w * (0.3 + 0.12 * face), h * 0.32, 22, 0, Math.PI * 2); ctx.fill();

    // 远处楼块
    var base = h * 0.78;
    for (var x = 0; x < w; ) {
        var bw = 18 + rng() * 30;
        var bh = 20 + rng() * 55;
        ctx.fillStyle = 'rgba(70,80,105,' + (0.55 + rng() * 0.3) + ')';
        ctx.fillRect(x, base - bh, bw, bh);
        x += bw + 4;
    }
    return c;
}

// 生成六面 canvas 数组（顺序对齐 WebGL 立方体面常量）
function makeEnvFaces() {
    return [0, 1, 2, 3, 4, 5].map(makeEnvFace);
}

// ---------- 上传 2D 位图纹理 ----------
function uploadTexture2D(gl, canvas) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
}

// ---------- 上传立方体环境贴图 ----------
function uploadCubemap(gl, faces) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    for (var i = 0; i < 6; i++) {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA,
            gl.RGBA, gl.UNSIGNED_BYTE, faces[i]);
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    return tex;
}

// ---------- UV 展开示意图（README 用：木箱六面如何摊平到一张位图）----------
function makeUVDiagram() {
    var w = 680, h = 460;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, w, h);

    // 展开布局：上排 顶-底，下排 后-左-前-右（标准十字展开）
    var cell = 100, gap = 18;
    var layout = [
        { label: '顶 (+Y)', x: 1, y: 0 }, { label: '底 (-Y)', x: 2, y: 0 },
        { label: '后 (-Z)', x: 0, y: 1 }, { label: '左 (-X)', x: 1, y: 1 },
        { label: '前 (+Z)', x: 2, y: 1 }, { label: '右 (+X)', x: 3, y: 1 }
    ];
    layout.forEach(function (f, i) {
        var x = 30 + f.x * (cell + gap);
        var y = 56 + f.y * (cell + gap);
        // 木纹底色
        ctx.fillStyle = '#9c6b3c';
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = '#4a2c12';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cell, cell);
        // UV 网格 2×2
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + cell / 2, y); ctx.lineTo(x + cell / 2, y + cell);
        ctx.moveTo(x, y + cell / 2); ctx.lineTo(x + cell, y + cell / 2);
        ctx.stroke();
        // 角点 UV 标注
        ctx.fillStyle = '#222';
        ctx.font = '10px sans-serif';
        ctx.fillText('(0,0)', x + 4, y + cell - 6);
        ctx.fillText('(1,0)', x + cell - 26, y + cell - 6);
        ctx.fillText('(0,1)', x + 4, y + 14);
        ctx.fillText('(1,1)', x + cell - 26, y + 14);
        ctx.fillStyle = '#4a2c12';
        ctx.font = '12px sans-serif';
        ctx.fillText(f.label, x, y - 6);
    });

    ctx.fillStyle = '#222';
    ctx.font = '14px sans-serif';
    ctx.fillText('木箱 UV 展开：每个面在位图上占一个 0~1 的 (u,v) 矩形，采样时按面映射回纹理', 40, h - 24);
    return c;
}
