import sharp from "sharp";
import path from "path";

const source = path.join(
  process.cwd(),
  "public",
  "waestudio-logo.png"
);

const background = {
  r: 9,
  g: 9,
  b: 9,
  alpha: 1,
};

async function createIcon(
  size,
  filename
) {
  const padding =
    Math.round(size * 0.14);

  const logoSize =
    size - padding * 2;

  await sharp(source)
    .resize({
      width: logoSize,
      height: logoSize,
      fit: "contain",
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background,
    })
    .resize(size, size)
    .png()
    .toFile(
      path.join(
        process.cwd(),
        "public",
        filename
      )
    );

  console.log(
    `Creado: public/${filename}`
  );
}

async function main() {
  await createIcon(
    192,
    "pwa-192.png"
  );

  await createIcon(
    512,
    "pwa-512.png"
  );

  await createIcon(
    180,
    "apple-touch-icon.png"
  );

  console.log(
    "Iconos PWA de WAESTUDIO generados correctamente."
  );
}

main().catch((error) => {
  console.error(
    "Error generando iconos PWA:",
    error
  );

  process.exit(1);
});