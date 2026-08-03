// make-icns.ts
import sharp from "npm:sharp"; // Deno 会自动拉取并使用 Node API 运行该包

// macOS 的标准比例：主体内容在 1024 像素的画布中约占 824 像素
const MAC_OS_SCALE = 0.805;

const SIZES = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await Deno.stat(path);
    return info.isFile;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }
    throw err;
  }
}

async function generateIcns(inputPath: string, outputPath: string) {
  // 覆盖防呆提示
  if (await fileExists(outputPath)) {
    const answer = prompt(`⚠️ 文件 "${outputPath}" 已存在，是否覆盖？[y/N]:`);
    if (answer?.trim().toLowerCase() !== "y") {
      console.log(`⏭️ 已跳过处理: ${inputPath}\n`);
      return;
    }
  }

  console.log(`📸 正在读取: ${inputPath}`);

  const tempDir = await Deno.makeTempDir();
  const iconsetPath = `${tempDir}/AppIcon.iconset`;

  try {
    await Deno.mkdir(iconsetPath);
    console.log("📐 正在利用 Sharp 缩放并填充透明边距...");

    // 遍历生成不同尺寸
    for (const { name, size } of SIZES) {
      // 计算主体图形大小和需要的边距
      const drawSize = Math.round(size * MAC_OS_SCALE);
      const padding = Math.floor((size - drawSize) / 2);
      // 补偿可能存在的像素奇数误差，确保加起来刚好等于严格的 size 尺寸
      const paddingRight = size - drawSize - padding;

      // 使用 Sharp 一气呵成：缩放主体 -> 扩充透明边距 -> 导出 PNG
      await sharp(inputPath)
        .resize(drawSize, drawSize, { fit: "contain" })
        .extend({
          top: padding,
          bottom: paddingRight,
          left: padding,
          right: paddingRight,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // 纯透明背景
        })
        .png()
        .toFile(`${iconsetPath}/${name}`);
    }

    console.log("📦 正在调用 iconutil 打包为 .icns...");
    const command = new Deno.Command("iconutil", {
      args: ["-c", "icns", iconsetPath, "-o", outputPath],
    });

    const { code, stderr } = await command.output();

    if (code !== 0) {
      console.error(`❌ iconutil 失败 (${inputPath}):`, new TextDecoder().decode(stderr));
    } else {
      console.log(`🎉 成功！已保存至: ${outputPath}\n`);
    }
  } catch (err) {
    console.error(`❌ 发生异常:`, err);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

function getOutputPath(input: string): string {
  const lastDotIndex = input.lastIndexOf(".");
  if (lastDotIndex === -1) return `${input}.icns`;
  return `${input.substring(0, lastDotIndex)}.icns`;
}

// ---------------- 主程序入口 ----------------
if (import.meta.main) {
  const args = Deno.args;

  if (args.length >= 2) {
    await generateIcns(args[0], args[1]);
  }
  else if (args.length === 1) {
    await generateIcns(args[0], getOutputPath(args[0]));
  }
  else {
    const cwd = Deno.cwd();
    console.log(`🔍 未指定参数，开始扫描当前目录下的 PNG 文件...\n${cwd}\n`);

    let foundCount = 0;
    for await (const entry of Deno.readDir(cwd)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith(".png")) {
        foundCount++;
        await generateIcns(entry.name, getOutputPath(entry.name));
      }
    }

    if (foundCount === 0) {
      console.log("🤷‍♂️ 当前目录下没有找到任何 .png 文件。你可以通过参数指定具体文件。");
    } else {
      console.log(`✅ 批量处理完成，共处理了 ${foundCount} 个 PNG 文件。`);
    }
  }
}
