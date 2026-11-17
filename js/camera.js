// js/camera.js — 轨迹球相机：拖拽旋转视角，滚轮缩放（四元数累积姿态）
// 复用 AP2 的轨迹球思路：把屏幕点投影到虚拟球面，由 p1、p2 求旋转轴与夹角。

function qIdentity() { return [1, 0, 0, 0]; }
function qMult(a, b) {
    return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
    ];
}
function qFromAxisAngle(axis, angleRad) {
    var s = Math.sin(angleRad / 2);
    return [Math.cos(angleRad / 2), axis[0] * s, axis[1] * s, axis[2] * s];
}
function qApply(q, v) {
    var u = [q[1], q[2], q[3]];
    var s = q[0];
    var t = cross(u, v);
    var r1 = add(scaleVec(2 * dot(u, v), u), scaleVec(s * s - dot(u, u), v));
    return add(r1, scaleVec(2 * s, t));
}

function Camera(canvas) {
    this.canvas = canvas;
    this.target = [0, 0.8, 0];
    this.R = 10.0;
    this.Q = qIdentity();
    this.forward0 = [0, 0, 1];      // 初始位于场景 +Z 侧，看向 -Z（背景墙在 -Z 远端）
    this.up0 = [0, 1, 0];
    this._bindMouse();
}

Camera.prototype.update = function () {
    var f = qApply(this.Q, this.forward0);
    var eye = add(this.target, scaleVec(this.R, f));
    var up = qApply(this.Q, this.up0);
    return { eye: eye, up: up };
};

Camera.prototype.reset = function () {
    this.Q = qIdentity();
    this.R = 10.0;
};

// 由方位角 / 仰角 / 距离设置初始姿态（URL 参数调试与截图用）
Camera.prototype.setPose = function (az, el, dist) {
    var qY = qFromAxisAngle([0, 1, 0], -az);
    var qX = qFromAxisAngle([1, 0, 0], el);
    this.Q = qMult(qY, qX);
    this.R = dist;
};

Camera.prototype._bindMouse = function () {
    var self = this;
    var dragging = false;
    var last = null;
    var downX = 0, downY = 0, moved = false;

    function toTrackball(e) {
        var rect = self.canvas.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        var y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        var d = x * x + y * y;
        var z = d <= 1 ? Math.sqrt(1 - d) : 0;
        return [x, y, z];
    }

    this.canvas.addEventListener('mousedown', function (e) {
        dragging = true; moved = false;
        downX = e.clientX; downY = e.clientY;
        last = toTrackball(e);
    });
    window.addEventListener('mouseup', function (e) {
        // 位移很小 → 视为点击（拾取），由 main.js 的 click 事件处理
        dragging = false; last = null;
    });
    window.addEventListener('mousemove', function (e) {
        if (!dragging || !last) return;
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true;
        var p = toTrackball(e);
        var axis = cross(last, p);
        var len = length(axis);
        if (len > 1e-5) {
            var angle = length(p - last) * Math.PI;
            var qr = qFromAxisAngle(normalize(axis), angle);
            self.Q = qMult(qr, self.Q);
        }
        last = p;
    });
    this.canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.R *= (1 + Math.sign(e.deltaY) * 0.08);
        self.R = Math.max(4, Math.min(30, self.R));
    }, { passive: false });

    // 暴露“是否发生拖拽”，供点击拾取判断
    this.wasDragged = function () { return moved; };
};
