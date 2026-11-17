// js/ui.js — 参数面板绑定：全局光照 / 阴影参数 / 选中物体材质联动
// state 由 main.js 传入；选中物体的材质改动直接写回 SCENE.objects 对应 mat。

function initUI(state, camera) {
    var $ = function (id) { return document.getElementById(id); };

    // ---------- 全局光照 ----------
    $('ui-ambient').oninput = function () {
        state.ambient = parseFloat(this.value);
        $('ui-ambient-val').textContent = this.value;
    };
    $('ui-use-ambient').onchange = function () { state.useAmbient = this.checked; };
    $('ui-use-diffuse').onchange = function () { state.useDiffuse = this.checked; };
    $('ui-use-specular').onchange = function () { state.useSpecular = this.checked; };
    $('ui-dir-on').onchange = function () { state.dirOn = this.checked; };
    $('ui-point-on').onchange = function () { state.pointOn = this.checked; };

    // ---------- 阴影参数 ----------
    $('ui-shadow-on').onchange = function () { state.shadowOn = this.checked; };
    $('ui-bias').oninput = function () {
        state.bias = parseFloat(this.value);
        $('ui-bias-val').textContent = this.value;
    };
    $('ui-pcf').oninput = function () {
        state.pcf = parseFloat(this.value);
        $('ui-pcf-val').textContent = this.value;
    };
    $('ui-half').oninput = function () {
        state.half = parseFloat(this.value);
        $('ui-half-val').textContent = this.value;
    };

    // ---------- 显示 ----------
    $('ui-sky').onchange = function () { state.sky = this.checked; };
    $('ui-bump').onchange = function () { state.bumpEnabled = this.checked; };
    $('ui-wire').onchange = function () { state.wire = this.checked; };
    $('view-reset').onclick = function () { camera.reset(); };

    // ---------- 选中物体材质 ----------
    function selectedMat() { return state.selected ? state.selected.mat : null; }

    $('ui-r').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.diffuse[0] = parseFloat(this.value);
        $('ui-r-val').textContent = this.value;
    };
    $('ui-g').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.diffuse[1] = parseFloat(this.value);
        $('ui-g-val').textContent = this.value;
    };
    $('ui-b').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.diffuse[2] = parseFloat(this.value);
        $('ui-b-val').textContent = this.value;
    };
    $('ui-spec').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.specular = parseFloat(this.value);
        $('ui-spec-val').textContent = this.value;
    };
    $('ui-shine').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.shininess = parseFloat(this.value);
        $('ui-shine-val').textContent = this.value;
    };
    $('ui-opacity').oninput = function () {
        var m = selectedMat(); if (!m) return;
        m.opacity = parseFloat(this.value);
        $('ui-opacity-val').textContent = this.value;
    };

    // 着色模型按钮
    var modelBtns = Array.prototype.slice.call(document.querySelectorAll('#shading-btns button'));
    modelBtns.forEach(function (btn) {
        btn.onclick = function () {
            var m = selectedMat(); if (!m) return;
            m.shading = parseInt(btn.dataset.model, 10);
            refreshMaterialPanel();
        };
    });

    // 把选中物体的材质值回填到面板
    function refreshMaterialPanel() {
        var o = state.selected;
        var m = o ? o.mat : null;
        $('sel-name').textContent = o ? o.name : '无（点击物体）';
        var disabled = !m;
        ['ui-r', 'ui-g', 'ui-b', 'ui-spec', 'ui-shine', 'ui-opacity'].forEach(function (id) {
            $(id).disabled = disabled;
        });
        if (!m) return;
        $('ui-r').value = m.diffuse[0]; $('ui-r-val').textContent = m.diffuse[0].toFixed(2);
        $('ui-g').value = m.diffuse[1]; $('ui-g-val').textContent = m.diffuse[1].toFixed(2);
        $('ui-b').value = m.diffuse[2]; $('ui-b-val').textContent = m.diffuse[2].toFixed(2);
        $('ui-spec').value = m.specular; $('ui-spec-val').textContent = m.specular.toFixed(2);
        $('ui-shine').value = m.shininess; $('ui-shine-val').textContent = m.shininess;
        $('ui-opacity').value = m.opacity; $('ui-opacity-val').textContent = m.opacity.toFixed(2);
        modelBtns.forEach(function (b) {
            b.classList.toggle('active', parseInt(b.dataset.model, 10) === m.shading);
        });
    }

    // 供 main.js 在选中变化后调用
    state.refreshPanel = refreshMaterialPanel;

    // 用当前 state 同步控件初始显示（query 参数可能改了默认值）
    function syncControls() {
        $('ui-ambient').value = state.ambient;
        $('ui-ambient-val').textContent = state.ambient;
        $('ui-use-ambient').checked = state.useAmbient;
        $('ui-use-diffuse').checked = state.useDiffuse;
        $('ui-use-specular').checked = state.useSpecular;
        $('ui-dir-on').checked = state.dirOn;
        $('ui-point-on').checked = state.pointOn;
        $('ui-shadow-on').checked = state.shadowOn;
        $('ui-bias').value = state.bias; $('ui-bias-val').textContent = state.bias;
        $('ui-pcf').value = state.pcf; $('ui-pcf-val').textContent = state.pcf;
        $('ui-half').value = state.half; $('ui-half-val').textContent = state.half;
        $('ui-sky').checked = state.sky;
        $('ui-bump').checked = state.bumpEnabled;
        $('ui-wire').checked = state.wire;
    }
    state.syncControls = syncControls;
}
