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
    var radius = 255;

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


        for ( var i = 0; i < geometry.faces.length; i++ ) 
        {
            face = geometry.faces[ i ];
            face.color.setRGB( 255, 255, 255 );		
        }

        //阴影
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
        mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(1.1, 1.1, 1.1);
        scene.add(mesh);

        geometry = new THREE.BoxGeometry(0.6, 0.6, 1);
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
        //window.addEventListener('resize', onWindowResize, false);
    }

    function addPoint(data) {
        var lat, lng, size, color, i;
        var subgeo = new THREE.Geometry();
        for (var i in data) {
            lat = data[i][2][1];
            lng = data[i][2][0];
            color = colorFn(0);
            size = data[i][1];

            var c = getCoordinate(lat, lng);
            point.position.x = c.x;
            point.position.y = c.y;
            point.position.z = c.z;
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

        this.points = new THREE.Mesh(subgeo, new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: THREE.FaceColors,
            morphTargets: false
        }));
        scene.add(this.points);
    };

    var t = 40;
    var p = 0;
    var d = 1;
    function addLine() {
        return;
        if (p > t) {
            d = -1;
            p = t;
            return false;
        }
        if (p < 0) {
            return false;
        }
        var p1 = [116.4551, 40.3539];
        var p2 = [106.3586, 38.1775];
        var middle = [p1[0]-(p1[0]-p2[0])/2, p1[1]-(p1[1]-p2[1])/2];
        var a = getCoordinate(p1[1], p1[0]);
        var b = getCoordinate(middle[1], middle[0], radius + 20);
        var c = getCoordinate(p2[1], p2[0]);

        var curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(a.x, a.y, a.z),
            new THREE.Vector3(b.x, b.y, b.z),
            new THREE.Vector3(c.x, c.y, c.z)
        );

        var geometry = new THREE.Geometry();
        if (d > 0) {
            for (var i = 0; i <= p; i++) {
                geometry.vertices.push(curve.getPoint(i / t));
            };
            var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
        } else {
            for (var i = p; i >= 0; i--) {
                geometry.vertices.push(curve.getPoint((t - i) / t));
            };
            var material = new THREE.LineBasicMaterial( { color : 0xffffff } );
        }
        var line = new THREE.Line( geometry, material );
        scene.add(line);
        p += d;
    }

    function addArea(data) {
        var group = new THREE.Group();
        var material = new THREE.LineBasicMaterial({
            color: 0xffffff
        });
        for (var i in data) {
            for (j in data[i][3]) {
                var geometry = new THREE.Geometry();
                for (var k in data[i][3][j]) {
                    var c = getCoordinate(data[i][3][j][k][1], data[i][3][j][k][0]);
                    geometry.vertices.push(
                        new THREE.Vector3(c.x, c.y, c.z)
                    );
                }
                group.add(new THREE.Line(geometry, material));
            }
        }
        scene.add(group);
    }

    function getCoordinate(lat, lng, r) {
        r = r || radius;
        var phi = (90 - lat) * Math.PI / 180;
        var theta = (180 - lng) * Math.PI / 180;
        var x = r * Math.sin(phi) * Math.cos(theta);
        var y = r * Math.cos(phi);
        var z = r * Math.sin(phi) * Math.sin(theta);
        return {x: x, y: y, z: z};
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
        addLine();
    }

    init();
    this.animate = animate;
    this.addPoint = addPoint;
    this.addArea = addArea;
    this.renderer = renderer;
    this.scene = scene;

    return this;

};
