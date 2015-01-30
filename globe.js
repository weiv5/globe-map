/**
 * dat.globe Javascript WebGL Globe Toolkit
 * http://dataarts.github.com/dat.globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, opts) {
    opts = opts || {};

    var colorFn = opts.colorFn || function(x) {
        var c = new THREE.Color();
        c.setHSL((0.6 - (x * 0.5)), 1.0, 0.5);
        return c;
    };
    var imgDir = opts.imgDir || '';

    var Shaders = {
        'earth': {
            uniforms: {
                'texture': {
                    type: 't',
                    value: null
                }
            },
            vertexShader: [
                'varying vec3 vNormal;',
                'varying vec2 vUv;',
                'void main() {',
                'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                'vNormal = normalize( normalMatrix * normal );',
                'vUv = uv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform sampler2D texture;',
                'varying vec3 vNormal;',
                'varying vec2 vUv;',
                'void main() {',
                'vec3 diffuse = texture2D( texture, vUv ).xyz;',
                'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
                'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
                'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
                '}'
            ].join('\n')
        },
        'atmosphere': {
            uniforms: {},
            vertexShader: [
                'varying vec3 vNormal;',
                'void main() {',
                'vNormal = normalize( normalMatrix * normal );',
                'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying vec3 vNormal;',
                'void main() {',
                'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
                'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
                '}'
            ].join('\n')
        }
    };

    var camera, scene, renderer, w, h;
    var mesh, atmosphere, point;

    var overRenderer;

    var curZoomSpeed = 0;
    var zoomSpeed = 50;

    var mouse = {
            x: 0,
            y: 0
        },
        mouseOnDown = {
            x: 0,
            y: 0
        },
        rotation = {
            x: 0,
            y: 0
        },
        target = {
            x: Math.PI / 10.0,
            y: Math.PI / 5.0
        },
        targetOnDown = {
            x: 0,
            y: 0
        };

    var distance = 100000,
        distanceTarget = 100000;
    var padding = 40;
    var PI_HALF = Math.PI / 2;
    var radius = 230;

    function init() {
        var shader, uniforms, material;

        container.style.color = '#fff';
        container.style.font = '13px/20px Arial, sans-serif';
        w = container.offsetWidth || window.innerWidth;
        h = container.offsetHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
        camera.position.z = distance;

        scene = new THREE.Scene();

        //地图
        var geometry = new THREE.SphereGeometry(radius, 40, 30);
        /*
        shader = Shaders['earth'];
        uniforms = THREE.UniformsUtils.clone(shader.uniforms);
        uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir + 'world.jpg');
        material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader

        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = Math.PI;
        scene.add(mesh);
        */

        //阴影
        /*
        shader = Shaders['atmosphere'];
        uniforms = THREE.UniformsUtils.clone(shader.uniforms);
        material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true

        });
        */
        mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(1.1, 1.1, 1.1);
        //scene.add(mesh);

        geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
        point = new THREE.Mesh(geometry);
        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.setSize(w, h);

        renderer.domElement.style.position = 'absolute';
        container.appendChild(renderer.domElement);
        container.addEventListener('mousedown', onMouseDown, false);
        container.addEventListener('mousewheel', onMouseWheel, false);
        container.addEventListener('mouseover', function() {
            overRenderer = true;
        }, false);
        container.addEventListener('mouseout', function() {
            overRenderer = false;
        }, false);
        window.addEventListener('resize', onWindowResize, false);
    }

    function addData(data) {
        var lat, lng, size, color, i, step;

        step = 2;
        var subgeo = new THREE.Geometry();
        for (i = 0; i < data.length; i += step) {
            lat = data[i];
            lng = data[i + 1];
            color = colorFn(0);
            size = 0;

            var phi = (90 - lat) * Math.PI / 180;
            var theta = (180 - lng) * Math.PI / 180;

            point.position.x = radius * Math.sin(phi) * Math.cos(theta);
            point.position.y = radius * Math.cos(phi);
            point.position.z = radius * Math.sin(phi) * Math.sin(theta);
            point.lookAt(mesh.position);
            point.scale.z = Math.max(size, 0.1); // avoid non-invertible matrix
            point.updateMatrix();

            for (var j = 0; j < point.geometry.faces.length; j++) {
                point.geometry.faces[j].color = color;
            }
            if (point.matrixAutoUpdate) {
                point.updateMatrix();
            }
            subgeo.merge(point.geometry, point.matrix);
        }
        addArea();

        this.points = new THREE.Mesh(subgeo, new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: THREE.FaceColors,
            morphTargets: false
        }));
        scene.add(this.points);

    };

    function addArea() {
		var californiaPts = [];
        var p = [
                    [96.416, 42.7588],
                    [96.416, 42.7148],
                    [95.9766, 42.4951],
                    [96.0645, 42.3193],
                    [96.2402, 42.2314],
                    [95.9766, 41.9238],
                    [95.2734, 41.6162],
                    [95.1855, 41.792],
                    [94.5703, 41.4844],
                    [94.043, 41.0889],
                    [93.8672, 40.6934],
                    [93.0762, 40.6494],
                    [92.6367, 39.6387],
                    [92.373, 39.3311],
                    [92.373, 39.1113],
                    [92.373, 39.0234],
                    [90.1758, 38.4961],
                    [90.3516, 38.2324],
                    [90.6152, 38.3203],
                    [90.5273, 37.8369],
                    [91.0547, 37.4414],
                    [91.3184, 37.0898],
                    [90.7031, 36.7822],
                    [90.791, 36.6064],
                    [91.0547, 36.5186],
                    [91.0547, 36.0791],
                    [90.8789, 36.0352],
                    [90, 36.2549],
                    [89.9121, 36.0791],
                    [89.7363, 36.0791],
                    [89.209, 36.2988],
                    [88.7695, 36.3428],
                    [88.5938, 36.4746],
                    [87.3633, 36.4307],
                    [86.2207, 36.167],
                    [86.1328, 35.8594],
                    [85.6055, 35.6836],
                    [85.0781, 35.7275],
                    [84.1992, 35.376],
                    [83.1445, 35.4199],
                    [82.8809, 35.6836],
                    [82.4414, 35.7275],
                    [82.002, 35.332],
                    [81.6504, 35.2441],
                    [80.4199, 35.4199],
                    [80.2441, 35.2881],
                    [80.332, 35.1563],
                    [80.2441, 35.2002],
                    [79.8926, 34.8047],
                    [79.8047, 34.4971],
                    [79.1016, 34.4531],
                    [79.0137, 34.3213],
                    [78.2227, 34.7168],
                    [78.0469, 35.2441],
                    [78.0469, 35.5078],
                    [77.4316, 35.4639],
                    [76.8164, 35.6396],
                    [76.5527, 35.8594],
                    [76.2012, 35.8154],
                    [75.9375, 36.0352],
                    [76.0254, 36.4746],
                    [75.8496, 36.6943],
                    [75.498, 36.7383],
                    [75.4102, 36.958],
                    [75.0586, 37.002],
                    [74.8828, 36.9141],
                    [74.7949, 37.0459],
                    [74.5313, 37.0898],
                    [74.5313, 37.2217],
                    [74.8828, 37.2217],
                    [75.1465, 37.4414],
                    [74.8828, 37.5732],
                    [74.9707, 37.749],
                    [74.8828, 38.4521],
                    [74.3555, 38.6719],
                    [74.1797, 38.6719],
                    [74.0918, 38.54],
                    [73.8281, 38.584],
                    [73.7402, 38.8477],
                    [73.8281, 38.9795],
                    [73.4766, 39.375],
                    [73.916, 39.5068],
                    [73.916, 39.6826],
                    [73.8281, 39.7705],
                    [74.0039, 40.0342],
                    [74.8828, 40.3418],
                    [74.7949, 40.5176],
                    [75.2344, 40.4297],
                    [75.5859, 40.6494],
                    [75.7617, 40.2979],
                    [76.377, 40.3857],
                    [76.9043, 41.001],
                    [77.6074, 41.001],
                    [78.1348, 41.2207],
                    [78.1348, 41.3965],
                    [80.1563, 42.0557],
                    [80.2441, 42.2754],
                    [80.1563, 42.627],
                    [80.2441, 42.8467],
                    [80.5078, 42.8906],
                    [80.4199, 43.0664],
                    [80.7715, 43.1982],
                    [80.4199, 44.165],
                    [80.4199, 44.6045],
                    [79.9805, 44.8242],
                    [79.9805, 44.9561],
                    [81.7383, 45.3955],
                    [82.0898, 45.2197],
                    [82.5293, 45.2197],
                    [82.2656, 45.6592],
                    [83.0566, 47.2412],
                    [83.6719, 47.0215],
                    [84.7266, 47.0215],
                    [84.9023, 46.8896],
                    [85.5176, 47.0654],
                    [85.6934, 47.2852],
                    [85.5176, 48.1201],
                    [85.7813, 48.4277],
                    [86.5723, 48.5596],
                    [86.8359, 48.8232],
                    [86.748, 48.9551],
                    [86.8359, 49.1309],
                    [87.8027, 49.1748],
                    [87.8906, 48.999],
                    [87.7148, 48.9111],
                    [88.0664, 48.7354],
                    [87.9785, 48.6035],
                    [88.5059, 48.3838],
                    [88.6816, 48.1641],
                    [89.1211, 47.9883],
                    [89.5605, 48.0322],
                    [89.7363, 47.8564],
                    [90.0879, 47.8564],
                    [90.3516, 47.6807],
                    [90.5273, 47.2412],
                    [90.8789, 46.9775],
                    [91.0547, 46.582],
                    [90.8789, 46.3184],
                    [91.0547, 46.0107],
                    [90.7031, 45.7471],
                    [90.7031, 45.5273],
                    [90.8789, 45.2197],
                    [91.582, 45.0879],
                    [93.5156, 44.9561],
                    [94.7461, 44.3408],
                    [95.3613, 44.2969],
                    [95.3613, 44.0332],
                    [95.5371, 43.9014],
                    [95.8887, 43.2422],
                    [96.3281, 42.9346],
                    [96.416, 42.7588]
        ];

        var geometry = new THREE.Geometry();
        var material = new THREE.LineBasicMaterial({
            color: 0xffffff
        });
        for (var i in p) {
            var phi = (90 - p[i][1]) * Math.PI / 180;
            var theta = (180 - p[i][0]) * Math.PI / 180;

            var x = radius * Math.sin(phi) * Math.cos(theta);
            var y = radius * Math.cos(phi);
            var z = radius * Math.sin(phi) * Math.sin(theta);

            geometry.vertices.push(
                new THREE.Vector3(x, y, z)
            );
        }
        var line = new THREE.Line( geometry, material );
        scene.add( line );
    }

    function onMouseDown(event) {
        event.preventDefault();

        container.addEventListener('mousemove', onMouseMove, false);
        container.addEventListener('mouseup', onMouseUp, false);
        container.addEventListener('mouseout', onMouseOut, false);

        mouseOnDown.x = -event.clientX;
        mouseOnDown.y = event.clientY;

        targetOnDown.x = target.x;
        targetOnDown.y = target.y;

        container.style.cursor = 'move';
    }

    function onMouseMove(event) {
        mouse.x = -event.clientX;
        mouse.y = event.clientY;

        var zoomDamp = distance / 1000;

        target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
        target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

        target.y = target.y > PI_HALF ? PI_HALF : target.y;
        target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
    }

    function onMouseUp(event) {
        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
        container.style.cursor = 'auto';
    }

    function onMouseOut(event) {
        container.removeEventListener('mousemove', onMouseMove, false);
        container.removeEventListener('mouseup', onMouseUp, false);
        container.removeEventListener('mouseout', onMouseOut, false);
    }

    function onMouseWheel(event) {
        event.preventDefault();
        if (overRenderer) {
            zoom(event.wheelDeltaY * 0.3);
        }
        return false;
    }

    function onWindowResize(event) {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.offsetWidth, container.offsetHeight);
    }

    function zoom(delta) {
        distanceTarget -= delta;
        distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
        distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
    }

    function animate() {
        requestAnimationFrame(animate);
        render();
    }

    function render() {
        zoom(curZoomSpeed);

        rotation.x += (target.x - rotation.x) * 0.1;
        rotation.y += (target.y - rotation.y) * 0.1;
        distance += (distanceTarget - distance) * 0.3;

        camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
        camera.position.y = distance * Math.sin(rotation.y);
        camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

        camera.lookAt(mesh.position);

        renderer.render(scene, camera);
    }

    init();
    this.animate = animate;
    this.addData = addData;
    this.renderer = renderer;
    this.scene = scene;

    return this;

};
