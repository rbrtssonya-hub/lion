# 传章地图运镜

`world-map.blend` 是用户提供的创作源。场景为 2000×1300、24 fps、1–204 帧；三个停顿分别是 1–19、93–111、186–204 帧。网页以 1000×650 的完整渲染动画显示相机运动，使用正向与逐帧反向视频支持前进、回看与中途改选，停顿时保留案例点位。网页不是实时三维场景。

渲染全帧可使用：

```powershell
E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/render-motion.py -- tmp/spread-map-motion
# 无 NVIDIA OptiX 时在末尾增加 --cpu；可加 --frames=1:100 拆分帧范围。
powershell -File source/models/spread-map/encode-motion.ps1 -FrameDirectory tmp/spread-map-motion -OutputDirectory tmp/spread-map-encoded -Ffmpeg <ffmpeg.exe的路径>
```

脚本使用 Cycles 12 samples 与原画幅的 50%，保留全部 204 帧；编码脚本拒绝覆盖现有输出。实际交付的静止区间 93–111 和 186–204 分别复用同段第 100、200 帧：逐帧核对相机矩阵、缩放和所有受驱动参数相同，时长与帧数未删减；其余运动帧逐帧渲染。完整帧比对工具 `scripts/verify-spread-map-motion.py` 需要 Python、Pillow、NumPy、FFmpeg 和 FFprobe，可比较两个编码视频与 PNG 序列。

60 fps 版本在相同场景和渲染质量下按真实 Blender 子帧采样，不能通过重复或补帧替代。先生成上述 204 张 PNG，然后运行：

```powershell
E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/render-motion-60.py -- tmp/spread-map-motion-60 --cache=tmp/spread-map-motion
powershell -File source/models/spread-map/encode-motion-60.ps1 -FrameDirectory tmp/spread-map-motion-60 -OutputDirectory tmp/spread-map-encoded-60 -Ffmpeg <ffmpeg.exe的路径>
```

也可使用 `--indices=1:180` 等互不重叠的范围并行或续渲，或加 `--cpu`。第 `n` 张输出（从 0 开始）求值原场景第 `1 + n × 24 / 60` 帧；整数帧及三个已核实的静止区间复用原 PNG，其余由 Blender 渲染子帧。共 510 帧，时长 8.5 秒；反向视频严格由该序列逆序生成，首尾帧的时间映射基点是 `509 / 60` 秒。原片最后的静止画面延续至输出末帧。编码脚本拒绝覆盖已有文件。

验证 Blender 渲染前后子帧及相机保持一致：`E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/check-subframe.py`。完整的 60 fps 视频逐帧比对可在原校验命令末尾加 `--fps=60`。
