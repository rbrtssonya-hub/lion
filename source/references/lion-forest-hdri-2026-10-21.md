# Blender forest 环境与网页质感差异

2026-10-21按用户提供的网页/Blender对照图核对。用户说明第二张在Blender使用 `forest.exr`；现有网页此前固定使用 `citrus_orchard_road_puresky_4k.exr`，两者并非同一照明环境。

## 真实资产与许可

- 本机来源：`F:/Blender/5.0/datafiles/studiolights/world/forest.exr`，Blender随安装分发的材质预览环境；按原字节复制，没有降采样、转成LDR或修改曝光。
- 运行副本：`source/public/assets/environments/forest.exr`，统一路径键 `assetPaths.lionForestHdri`，经 `media` 解析部署基址。
- EXR头：1024×512，DWAB压缩；552,641字节，SHA256 `bdf2298244affa0f85509380fd130ac6d4dfaa3c856df065998f7f4c1a93dc0d`。
- 作者 Greg Zaal，来源 Poly Haven 的 [Ninomaru Teien](https://polyhaven.com/a/ninomaru_teien)。Blender安装随带许可与[官方仓库的对应许可](https://raw.githubusercontent.com/blender/blender/main/release/datafiles/studiolights/world/license.txt)均声明工作室HDRI使用CC0，并明确forest对应上述素材。原许可逐字复制到 `source/public/assets/environments/blender-studiolights-LICENSE.txt`，随网页发布包保留。2026-10-21实际联网核对官方仓库及素材原站，两者信息相符。

该副本就是本机Blender的1K预览环境，不能称为原站16K版本。原柑橘EXR继续保留。

## 为什么截图仍会不同

1. **环境和额外灯不同。** 用户截图的forest与网页原柑橘环境具有不同光向和明暗。动作厅还叠加主光2.2、补光1、轮廓1.1、侧光0.4、半球0.35及建筑灯；这些灯可以进一步冲淡环境自身的阴影和红毛饱和感。需要在同一HDRI、旋转和曝光下对照，再调辅助灯，不能仅看环境文件名。
2. **比较的是不同渲染实现。** Blender的[材质预览](https://docs.blender.org/manual/en/dev/editors/3dview/display/shading.html)使用EEVEE与HDRI，并允许独立控制Scene Lights、Scene World、旋转和强度。历史源检查中World只有常量Background，因此它不自动等于用户视口的forest预览配置；本轮未读取用户当前Blender会话的预览旋转/强度，不能声称精确复现第二张。
3. **完整发丝不等于相同着色结果。** `lionFullHair.js`保留33组、2,295,421根发丝与19,957,105源点，以一像素线段及朝相机的发丝法线适配PBR材质。源导出报告为EEVEE/STRAND；[Blender对STRAND的说明](https://docs.blender.org/manual/en/3.1/render/eevee/render_settings/hair.html)同样描述为约一像素、忽略直径参数。网页仍不具备EEVEE同样的发丝遮挡、阴影与采样。动作页原本只让实体模型投地面阴影，狮子不接收自阴影，不能将毛发层次差全部归因于缺毛或HDRI。
4. **材质/色彩转换也有边界。** 现有源材质为Principled BSDF类PBR与纹理，不应误称全部使用Principled Hair BSDF。glTF保留了颜色、roughness以及sheen/specular等扩展，但[Blender官方文档](https://docs.blender.org/manual/en/3.6/addons/import_export/scene_gltf2.html)说明其材料系统与Blender不同；任意程序节点并不随glTF直接运行。两章虽采用AgX/EV0，Three.js r160的AgX实现仍不等于Blender OCIO逐像素输出。

本轮不删改源模型、毛发文件、数量、源材质颜色或发丝shader。建议先选forest，固定视角/旋转/EV0，再减弱辅助灯观察；任何具体默认值和视觉改善以本轮实际浏览器验证为准，不能把只读诊断当作已测结论。

## 本项实际检查

本机Node通过项目锁定Three.js r160的 `EXRLoader.setDataType(HalfFloatType).parse` 成功解码该原字节文件：1024×512、`Uint16Array`半浮点数据、DWAB压缩。复制后SHA256与本机原件一致。设置联动、网页像素、资源释放及生产包一致性由本轮根任务的验证记录统一记录；此处不预写通过。
