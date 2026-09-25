const particleCanvasElement = document.getElementById("particles");

if (particleCanvasElement) {
    function startParticleField() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            65,
            innerWidth / innerHeight,
            0.1,
            100
        );
        camera.position.z = 7;

        const renderer = new THREE.WebGLRenderer({
            canvas: particleCanvasElement,
            alpha: true,
            antialias: true
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
        renderer.setSize(innerWidth, innerHeight);

        const amount = innerWidth < 600 ? 320 : 650;
        const positions = new Float32Array(amount * 3);

        for (let index = 0; index < amount; index++) {
            positions[index * 3] = (Math.random() - 0.5) * 18;
            positions[index * 3 + 1] = (Math.random() - 0.5) * 12;
            positions[index * 3 + 2] = (Math.random() - 0.5) * 14;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        const dotCanvas = document.createElement("canvas");
        dotCanvas.width = 32;
        dotCanvas.height = 32;
        const dotContext = dotCanvas.getContext("2d");
        const dotGradient = dotContext.createRadialGradient(16, 16, 1, 16, 16, 15);
        dotGradient.addColorStop(0, "rgba(255,255,255,1)");
        dotGradient.addColorStop(0.48, "rgba(255,255,255,.92)");
        dotGradient.addColorStop(0.8, "rgba(255,255,255,.38)");
        dotGradient.addColorStop(1, "rgba(255,255,255,0)");
        dotContext.fillStyle = dotGradient;
        dotContext.fillRect(0, 0, 32, 32);

        const dotTexture = new THREE.CanvasTexture(dotCanvas);
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            map: dotTexture,
            size: 0.04,
            transparent: true,
            opacity: 0.62,
            alphaTest: 0.02,
            depthWrite: false,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        let targetMouseX = 0;
        let targetMouseY = 0;
        let mouseX = 0;
        let mouseY = 0;

        window.addEventListener("pointermove", event => {
            targetMouseX = (event.clientX / innerWidth) * 2 - 1;
            targetMouseY = 1 - (event.clientY / innerHeight) * 2;
        }, { passive: true });

        window.addEventListener("pointerleave", () => {
            targetMouseX = 0;
            targetMouseY = 0;
        }, { passive: true });

        let lastFrame = 0;
        function animate(time = 0) {
            requestAnimationFrame(animate);
            if (document.hidden || time - lastFrame < 1000 / 24) return;
            lastFrame = time;

            mouseX += (targetMouseX - mouseX) * 0.025;
            mouseY += (targetMouseY - mouseY) * 0.025;

            const idleSpin = Math.max(Math.abs(mouseX), Math.abs(mouseY)) < 0.08
                ? 0.00042
                : 0;

            particles.rotation.y += mouseX * 0.0015 + idleSpin;
            particles.rotation.x += mouseY * 0.0009 + idleSpin * 0.3;

            renderer.render(scene, camera);
        }

        animate();

        window.addEventListener("resize", () => {
            camera.aspect = innerWidth / innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(innerWidth, innerHeight);
        });
    }

    if (window.THREE) {
        startParticleField();
    } else {
        const threeScript = document.createElement("script");
        threeScript.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
        threeScript.onload = startParticleField;
        threeScript.onerror = () => console.warn("Particle background could not load.");
        document.head.appendChild(threeScript);
    }
}
