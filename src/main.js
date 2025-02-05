import "./style.css";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import Toastify from "toastify-js";

const loadingToast = Toastify({
  text: "FFMPEG libraries are loading...",
  duration: -1,
  className: "info",
});

loadingToast.showToast();

/**
 * @type {HTMLInputElement}
 */
const inputFile = document.getElementById("gif-file");

/**
 * @type {HTMLInputElement}
 */
const inputRepetitions = document.getElementById("gif-repetitions");

/**
 * @type {HTMLInputElement}
 */
const inputFPS = document.getElementById("gif-fps");

/**
 * @type {HTMLButtonElement}
 */
const inputPrintBtn = document.getElementById("gif-print");

/**
 * @type {HTMLInputElement}
 */
const inputRows = document.getElementById("gif-rows");

/**
 * @type {HTMLIFrameElement | null}
 */
let iframe;

/**
 * @type {string[] | null}
 */
let lastPngUrls;

const baseUrl = "https://unpkg.com/@ffmpeg/core@latest/dist/esm";

const librariesPromises = Promise.all([
  toBlobURL(baseUrl + "/ffmpeg-core.js", "text/javascript"),
  toBlobURL(baseUrl + "/ffmpeg-core.wasm", "application/wasm"),
])
  .then(val => {

    Toastify({
      text: "FFMPEG libraries succesfully loaded!",
      className: "success",
    }).showToast();

    inputPrintBtn.onclick = () => {
      main();
    }

    return val;

  })
  .catch(() => Toastify({
    text: "FFMPEG libraries failed to load. Check your connection to internet and refresh the page.",
    className: "error",
    duration: -1,
  }).showToast())
  .finally(() => loadingToast.hideToast());

async function main() {

  /* START CLEANUP */

  Toastify({
    text: "Converting, please wait...",
    className: "info",
  }).showToast();

  iframe?.parentElement?.removeChild(iframe);

  lastPngUrls?.forEach(val => URL.revokeObjectURL(val));

  /* END CLEANUP */

  const file = inputFile.files[0];

  if (!file) {
    Toastify({
      text: "Error: Please upload at least 1 file",
      className: "error",
    }).showToast();
    return;
  }

  inputFile.files = null;

  let numRepetitions = inputRepetitions.valueAsNumber;
  if (isNaN(numRepetitions) || numRepetitions < 1) {
    numRepetitions = 1;
  }

  let numFPS = inputFPS.valueAsNumber;
  if (isNaN(numFPS) || numFPS < 1) {
    numFPS = 10;
  }

  let numRows = inputRows.valueAsNumber;
  if (isNaN(numRows) || numRows < 1) {
    numRows = 1;
  }

  const [coreURL, wasmURL] = await librariesPromises;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL,
    wasmURL,
  });

  const inputFilepath = `/input`;
  const outputFilepath = `/output/output_%d.png`;

  await ffmpeg.writeFile(inputFilepath, new Uint8Array(await file.arrayBuffer()));

  await ffmpeg.createDir("/output");

  await ffmpeg.exec(["-i", inputFilepath, "-vf", `fps=${numFPS},scale=640:-1`, outputFilepath]);

  const listDir = await ffmpeg.listDir("/output");

  let pngUrls = [];

  for (const { name, isDir } of listDir) {
    if (isDir) continue;

    const { buffer } = new Uint8Array(await ffmpeg.readFile("/output/" + name));

    const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));

    pngUrls.push(blobUrl);
  }

  lastPngUrls = [...pngUrls];

  for (let i = 0; i < numRepetitions - 1; i++) {
    pngUrls = [...pngUrls, ...lastPngUrls];
  }

  printPNGs(pngUrls, numRows);
}

function printPNGs(pngUrls, imagesPerRow) {
  iframe = document.createElement("iframe");

  iframe.addEventListener("load", async () => {

    const tempWindow = iframe.contentWindow;
    tempWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
            }
            img {
              object-fit: contain;
              width: 100%;
            }
            .outer-container {
              width: ${8.2 / imagesPerRow}in;
              margin: 0.02in;
              display: inline-block;
              border: 1px dashed black;
            }
            .inner-container {
              display: flex;
            }
            .sheet-binding {
              flex: 0 0 20mm;
              display: flex;
              padding: 5mm 0;
              flex-direction: column;
              padding: 5mm 0;
              justify-content: space-between;
              align-items: center;
            }
            .img-container {
              flex: 1;
              display: flex;
            }
            .hole {
              border: 1px dashed black;
              width: 6.5mm;
              height: 6.5mm;
              border-radius: 9999px;
            }
          </style>
        </head>
        <body>
          ${pngUrls.map((url) => `
            <div class="outer-container">
              <div class="inner-container">
                <div class="sheet-binding">
                  <i class="hole"></i>
                  <i class="hole"></i>
                </div>
                <div class="img-container">
                  <img src="${url}">
                </div>
              </div>
            </div>
          `.trim()).join("\n")}
        </body>
        </html>
      `.trim());

    /*
      Bug with Chrome where it doesn't load images properly (images stays blank when printing)
      So we are awaiting until all images gets loaded
    */
    await Promise.all(
      Array.from(tempWindow.document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => {
          img.onload = img.onerror = () => resolve();
        }))
    );

    tempWindow.print();
  });

  document.body.appendChild(iframe);
}
