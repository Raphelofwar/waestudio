import sharp from "sharp";
import path from "path";

const source = path.join(
  process.cwd(),
  "public",
  "waestudio-logo.png"
);

const BACKGROUND = {
  r: 9,
  g: 9,
  b: 9,
  alpha: 1,
};

async function extractMainMark() {
  const trimmedBuffer =
    await sharp(source)
      .trim()
      .png()
      .toBuffer();

  const { data, info } =
    await sharp(trimmedBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

  const rowInk = new Array(
    info.height
  ).fill(0);

  for (let y = 0; y < info.height; y++) {
    let count = 0;

    for (let x = 0; x < info.width; x++) {
      const index =
        (y * info.width + x) * 4;

      if (data[index + 3] > 18) {
        count++;
      }
    }

    rowInk[y] = count;
  }

  const startSearch = Math.floor(
    info.height * 0.40
  );

  const endSearch = Math.floor(
    info.height * 0.92
  );

  const blankThreshold = Math.max(
    1,
    Math.floor(info.width * 0.008)
  );

  let bestStart = -1;
  let bestEnd = -1;
  let runStart = -1;

  for (
    let y = startSearch;
    y <= endSearch;
    y++
  ) {
    const blank =
      rowInk[y] <= blankThreshold;

    if (blank && runStart === -1) {
      runStart = y;
    }

    const runFinished =
      (!blank || y === endSearch) &&
      runStart !== -1;

    if (runFinished) {
      const runEnd =
        blank && y === endSearch
          ? y
          : y - 1;

      if (
        bestStart === -1 ||
        runEnd - runStart >
          bestEnd - bestStart
      ) {
        bestStart = runStart;
        bestEnd = runEnd;
      }

      runStart = -1;
    }
  }

  const cropHeight =
    bestStart > 0
      ? bestStart
      : Math.floor(info.height * 0.68);

  const cropped = await sharp(
    trimmedBuffer
  )
    .extract({
      left: 0,
      top: 0,
      width: info.width,
      height: Math.max(1, cropHeight),
    })
    .png()
    .toBuffer();

  return removeDarkBackground(cropped);
}

async function removeDarkBackground(
  imageBuffer
) {
  const { data, info } =
    await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const originalAlpha = data[i + 3];

    /*
     * Identificamos el símbolo dorado
     * por la diferencia entre canales
     * de color.
     *
     * El negro y los grises tienen
     * valores similares en R, G y B.
     * Por eso se vuelven transparentes.
     */
    const goldStrength = Math.min(
      (red - blue - 12) / 22,
      (green - blue - 3) / 12,
      (red - green - 3) / 12,
      (red - 25) / 35
    );

    const opacity = Math.max(
      0,
      Math.min(1, goldStrength)
    );

    data[i + 3] = Math.round(
      originalAlpha * opacity
    );
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({
      background: "#00000000",
      threshold: 8,
    })
    .png()
    .toBuffer();
}

async function createIcon(
  markBuffer,
  size,
  filename,
  markScale
) {
  const markSize = Math.round(
    size * markScale
  );

  const resizedMark =
    await sharp(markBuffer)
      .resize({
        width: markSize,
        height: markSize,
        fit: "contain",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([
      {
        input: resizedMark,
        gravity: "center",
      },
    ])
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
  const mark =
    await extractMainMark();

  await createIcon(
    mark,
    192,
    "waestudio-app-192.png",
    0.88
  );

  await createIcon(
    mark,
    512,
    "waestudio-app-512.png",
    0.88
  );

  await createIcon(
    mark,
    512,
    "waestudio-maskable-512.png",
    0.62
  );

  await createIcon(
    mark,
    180,
    "waestudio-apple-180.png",
    0.84
  );

  console.log(
    "Iconos WAESTUDIO generados correctamente."
  );
}

main().catch((error) => {
  console.error(
    "Error generando iconos:",
    error
  );

  process.exit(1);
});