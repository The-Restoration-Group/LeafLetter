async function startLeafLetter() {
  const settings = await chrome.storage.local.get(['enabled']);
  if (!settings.enabled || !navigator.gpu) return;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    opacity: '0.6'
  });
  document.body.appendChild(canvas);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  const resize = () => {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    context.configure({ device, format, alphaMode: 'premultiplied' });
  };
  window.onresize = resize;
  resize();

  const shaderModule = device.createShaderModule({
    code: `
      struct Uniforms { time: f32, res: vec2f };
      @group(0) @binding(0) var<uniform> u: Uniforms;

      @vertex
      fn v_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
        return vec4f(pos[i], 0.0, 1.0);
      }

      @fragment
      fn f_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
        let uv = pos.xy / u.res;
        let center_dist = distance(uv, vec2f(0.5));
        
        var color = vec3f(0.0, 0.05, 0.1);
        
        let scanline = sin(pos.y * 0.4 + u.time * 10.0) * 0.08;
        let noise = (sin(uv.x * 500.0 + u.time) * cos(uv.y * 500.0 - u.time)) * 0.02;
        
        color += vec3f(scanline + noise);
        
        let vignette = smoothstep(1.0, 0.3, center_dist);
        color *= vignette;
        
        let glow = smoothstep(0.5, 1.5, center_dist) * vec3f(0.0, 1.0, 0.7);
        color += glow * 0.15;

        return vec4f(color, 0.4);
      }
    `
  });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'v_main' },
    fragment: { module: shaderModule, entryPoint: 'f_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });

  function render(time) {
    const uniformData = new Float32Array([time / 1000, canvas.width, canvas.height, 0]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

startLeafLetter();
