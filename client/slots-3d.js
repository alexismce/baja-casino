(() => {
  let babylonLoad;

  function loadBabylon() {
    if (window.BABYLON) return Promise.resolve();
    if (!babylonLoad) {
      babylonLoad = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/client/babylon.js";
        script.onload = () => window.BABYLON ? resolve() : reject(new Error("Babylon.js did not initialize."));
        script.onerror = () => reject(new Error("Could not load Babylon.js."));
        document.head.appendChild(script);
      }).catch((error) => {
        babylonLoad = undefined;
        throw error;
      });
    }
    return babylonLoad;
  }

  class Slots3D {
    constructor(parent, reducedMotion, effectScale = 1, onFailure) {
      const B = window.BABYLON;
      if (!B?.Engine.isSupported()) throw new Error("WebGL is not available in this browser.");

      this.canvas = document.createElement("canvas");
      this.canvas.className = "slots-3d-canvas";
      this.canvas.setAttribute("aria-hidden", "true");
      parent.appendChild(this.canvas);
      this.reducedMotion = reducedMotion;
      this.spinning = Array(5).fill(false);
      this.disposed = false;
      this.onFailure = onFailure;
      this.lowPower = reducedMotion
        || navigator.connection?.saveData === true
        || (navigator.deviceMemory && navigator.deviceMemory <= 4)
        || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
        || effectScale < 0.35;

      try {
        this.engine = new B.Engine(this.canvas, !this.lowPower, {
          alpha: true,
          preserveDrawingBuffer: false,
          premultipliedAlpha: true,
          stencil: false,
          powerPreference: this.lowPower ? "low-power" : "high-performance",
        });
        this.engine.setHardwareScalingLevel(this.lowPower ? 1.35 : 1);
        this.scene = new B.Scene(this.engine);
        this.scene.clearColor = new B.Color4(0, 0, 0, 0);
        this.camera = new B.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 15, B.Vector3.Zero(), this.scene);
        this.camera.inputs.clear();
        this.camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
        this.camera.orthoLeft = -3.15;
        this.camera.orthoRight = 3.15;
        this.camera.orthoTop = 1.7;
        this.camera.orthoBottom = -1.7;

        const ambient = new B.HemisphericLight("ambient", new B.Vector3(-0.4, 1, -1), this.scene);
        ambient.intensity = 1.1;
        ambient.groundColor = new B.Color3(0.015, 0.025, 0.05);
        const key = new B.DirectionalLight("key", new B.Vector3(-0.7, -0.5, 1), this.scene);
        key.diffuse = new B.Color3(0.72, 0.95, 1);
        key.specular = new B.Color3(1, 0.9, 0.65);
        key.intensity = 1.5;
        const rim = new B.PointLight("rim", new B.Vector3(4.5, 2.8, -3.5), this.scene);
        rim.diffuse = new B.Color3(1, 0.28, 0.7);
        rim.specular = new B.Color3(1, 0.6, 0.85);
        rim.intensity = 40;
        rim.range = 12;
        this.glow = B.GlowLayer ? new B.GlowLayer("neon-glow", this.scene, { blurKernelSize: 20 }) : undefined;
        if (this.glow) this.glow.intensity = 0.48;
        if (B.DefaultRenderingPipeline) {
          this.pipeline = new B.DefaultRenderingPipeline("lucky-lounge-pipeline", false, this.scene, [this.camera], true);
          this.pipeline.fxaaEnabled = !this.lowPower;
          this.pipeline.samples = this.lowPower ? 1 : 2;
          this.pipeline.bloomEnabled = !reducedMotion && effectScale > 0.15;
          this.pipeline.bloomThreshold = 0.72;
          this.pipeline.bloomKernel = this.lowPower ? 16 : 32;
          this.pipeline.bloomWeight = this.lowPower ? 0.16 : 0.25;
          this.pipeline.bloomScale = 0.45;
        }

        this.materials = {};
        for (const name of ["question", "seven", "cherry", "orange", "watermelon", "grapes"]) {
          const material = new B.PBRMaterial(`symbol-${name}`, this.scene);
          const texture = new B.Texture(
            `/client/assets/slots/${name}.svg`,
            this.scene,
            false,
            true,
            B.Texture.TRILINEAR_SAMPLINGMODE,
            () => this.render(),
            (_message, error) => !this.disposed && this.onFailure(error ?? new Error(`Could not load the ${name} symbol.`)),
          );
          texture.hasAlpha = true;
          material.albedoTexture = texture;
          material.emissiveTexture = texture;
          material.emissiveColor = new B.Color3(0.2, 0.23, 0.25);
          material.metallic = 0.1;
          material.roughness = 0.25;
          material.useAlphaFromAlbedoTexture = true;
          this.materials[name] = material;
        }

        this.tiles = Array.from({ length: 5 }, (_, column) =>
          Array.from({ length: 3 }, (_, row) => {
            const tile = B.MeshBuilder.CreateBox(`reel-${column}-${row}`, { width: 1, height: 0.83, depth: 0.23 }, this.scene);
            tile.position = new B.Vector3((column - 2) * 1.2, (1 - row) * 0.98, 0);
            const frame = new B.PBRMaterial(`frame-${column}-${row}`, this.scene);
            frame.albedoColor = new B.Color3(0.035, 0.085, 0.14);
            frame.emissiveColor = B.Color3.Black();
            frame.metallic = 0.88;
            frame.roughness = 0.18;
            frame.clearCoat.isEnabled = true;
            frame.clearCoat.intensity = 0.85;
            tile.material = frame;
            const symbol = B.MeshBuilder.CreatePlane(`symbol-${column}-${row}`, { width: 0.74, height: 0.7 }, this.scene);
            symbol.parent = tile;
            symbol.position.z = -0.13;
            symbol.material = this.materials.question;
            return { tile, symbol, frame };
          }),
        );

        this.scene.onBeforeRenderObservable.add(() => {
          const delta = Math.min(this.engine.getDeltaTime(), 50) * 0.012;
          for (let column = 0; column < this.tiles.length; column += 1) {
            if (!this.spinning[column]) continue;
            this.tiles[column].forEach(({ tile }) => {
              tile.rotation.x += delta;
              tile.rotation.y = Math.sin(tile.rotation.x) * 0.035;
            });
          }
        });
        this.resizeObserver = new ResizeObserver(() => {
          if (this.disposed) return;
          this.engine.resize();
          this.render();
        });
        this.resizeObserver.observe(this.canvas);
        this.contextLost = () => this.onFailure(new Error("The WebGL context was lost."));
        this.canvas.addEventListener("webglcontextlost", this.contextLost);
        this.scene.executeWhenReady(() => this.render());
        this.render();
      } catch (error) {
        this.destroy();
        throw error;
      }
    }

    render() {
      if (!this.disposed && this.scene && this.tiles) this.scene.render();
    }

    start() {
      this.spinning.fill(!this.reducedMotion);
      this.tiles.flat().forEach(({ frame }) => frame.emissiveColor = window.BABYLON.Color3.Black());
      if (!this.reducedMotion) this.engine.runRenderLoop(() => this.render());
      this.render();
    }

    settle(column, symbols) {
      this.spinning[column] = false;
      this.tiles[column].forEach(({ tile, symbol }, row) => {
        tile.rotation.set(0, 0, 0);
        symbol.material = this.materials[symbols[row]?.toLowerCase()] ?? this.materials.question;
      });
      if (!this.spinning.some(Boolean)) this.engine.stopRenderLoop();
      this.render();
    }

    highlight(paylines) {
      for (const win of paylines) {
        for (let column = 0; column < win.symbols; column += 1) {
          this.tiles[column][win.rows[column]].frame.emissiveColor = new window.BABYLON.Color3(0.04, 0.55, 0.46);
        }
      }
      this.render();
    }

    reset() {
      this.spinning.fill(false);
      this.engine.stopRenderLoop();
      this.tiles.flat().forEach(({ tile, symbol, frame }) => {
        tile.rotation.set(0, 0, 0);
        symbol.material = this.materials.question;
        frame.emissiveColor = window.BABYLON.Color3.Black();
      });
      this.render();
    }

    destroy() {
      this.disposed = true;
      this.resizeObserver?.disconnect();
      if (this.contextLost) this.canvas?.removeEventListener("webglcontextlost", this.contextLost);
      this.engine?.stopRenderLoop();
      this.pipeline?.dispose();
      this.scene?.dispose();
      this.engine?.dispose();
      this.canvas?.remove();
    }
  }

  window.LuckySlots3D = { loadBabylon, Slots3D };
})();
