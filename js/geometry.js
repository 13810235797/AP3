// js/geometry.js — 几何生成：UV 球 / 立方体 / 平面 / 天空盒立方体
// 约定：所有几何以原点为中心；法线为单位向量；UV 范围 0~1。

// ---------- UV 球（复用 AP2 约定：Y 为极轴，v=1 在北极）----------
function createSphere(rows, cols) {
    var positions = [];
    var normals = [];
    var texCoords = [];
    var indices = [];

    for (var r = 0; r <= rows; r++) {
        var phi = (r / rows) * Math.PI;          // 0(北极) → pi(南极)
        var y = Math.cos(phi);
        var rr = Math.sin(phi);
        for (var c = 0; c <= cols; c++) {
            var theta = (c / cols) * 2 * Math.PI;
            var x = rr * Math.cos(theta);
            var z = rr * Math.sin(theta);
            positions.push(x, y, z);
            normals.push(x, y, z);
            texCoords.push(c / cols, 1 - r / rows);
        }
    }
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            var a = i * (cols + 1) + j;
            var b = a + cols + 1;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices)
    };
}

// ---------- 立方体（带面法线与每面 UV 0~1，便于木箱贴图讲解 UV 展开）----------
// w/h/d 为长宽高；返回 24 顶点（每面 4 顶点，法线不跨面插值）
function createBox(w, h, d) {
    var positions = [], normals = [], texCoords = [], indices = [];
    var hw = w / 2, hh = h / 2, hd = d / 2;

    // 每个面：四个角的局部坐标（u, v 顺序固定）+ 法线
    var faces = [
        // +X
        { n: [1, 0, 0],  p: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
        // -X
        { n: [-1, 0, 0], p: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] },
        // +Y
        { n: [0, 1, 0],  p: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
        // -Y
        { n: [0, -1, 0], p: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
        // +Z
        { n: [0, 0, 1],  p: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
        // -Z
        { n: [0, 0, -1], p: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] }
    ];
    var uv = [[0, 0], [1, 0], [1, 1], [0, 1]];

    for (var f = 0; f < faces.length; f++) {
        var base = f * 4;
        for (var k = 0; k < 4; k++) {
            positions.push.apply(positions, faces[f].p[k]);
            normals.push.apply(normals, faces[f].n);
            texCoords.push(uv[k][0], uv[k][1]);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices)
    };
}

// ---------- 单位平面（XZ，边长 1，中心原点），法线 +Y；尺寸由模型缩放控制 ----------
// repeatU / repeatV 为 UV 重复次数
function createPlane(repeatU, repeatV) {
    var ru = repeatU || 1, rv = repeatV || 1;
    var positions = [
        -0.5, 0, -0.5,   0.5, 0, -0.5,   0.5, 0, 0.5,   -0.5, 0, 0.5
    ];
    var normals = [
        0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0
    ];
    var texCoords = [
        0, 0,   ru, 0,   ru, rv,   0, rv
    ];
    var indices = [0, 1, 2, 0, 2, 3];
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        texCoords: new Float32Array(texCoords),
        indices: new Uint16Array(indices)
    };
}

// ---------- 天空盒立方体（仅位置，边长 2，位于原点）----------
function createSkyBox(size) {
    var s = size / 2;
    var positions = new Float32Array([
        -s, -s, -s,   s, -s, -s,   s,  s, -s,  -s,  s, -s,
        -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s
    ]);
    var indices = new Uint16Array([
        0, 1, 2, 0, 2, 3,       // -Z
        4, 6, 5, 4, 7, 6,       // +Z
        0, 4, 5, 0, 5, 1,       // -X? 简化：上下左右
        3, 2, 6, 3, 6, 7,
        1, 5, 6, 1, 6, 2,
        0, 3, 7, 0, 7, 4
    ]);
    return { positions: positions, indices: indices };
}
