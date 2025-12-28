const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "/tmp" });

// Prevent Railway/browser 404
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Download helper (supports http/https + redirects)
function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https://") ? https : http;

    const file = fs.createWriteStream(dest);
    const req = proto.get(url, (res) => {
      // handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        file.close(() => {
          fs.unlink(dest, () => {
            resolve(download(res.headers.location, dest, redirectsLeft - 1));
          });
        });
        return;
      }

      if (res.statusCode !== 200) {
        file.close(() => {
          fs.unlink(dest, () => reject(new Error(`Download failed: ${res.statusCode}`)));
        });
        return;
      }

      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    });

    req.on("error", (err) => {
      file.close(() => fs.unlink(dest, () => reject(err)));
    });
  });
}

app.post(
  "/render",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "subs", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Validate inputs
      const bgUrl = req.body?.background_url;
      if (!bgUrl) return res.status(400).send("Missing background_url");

      if (!req.files || !req.files.audio || !req.files.subs) {
        return res.status(400).send("Missing audio or subs file");
      }

      if (!ffmpegPath) {
        return res.status(500).send("ffmpeg-static path not found");
      }

      const bgPath = "/tmp/background.mp4";
      await download(bgUrl, bgPath);

      const audioPath = req.files.audio[0].path;
      const subsPath = req.files.subs[0].path;
      const outPath = "/tmp/final.mp4";

      // Windows paths can break subtitle filter; Railway is Linux, but this makes it safer.
      const subsForFfmpeg = subsPath.replace(/\\/g, "/");

      const args = [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        bgPath,
        "-i",
        audioPath,
        "-vf",
        `subtitles=${subsForFfmpeg}`,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-shortest",
        outPath,
      ];

      execFile(ffmpegPath, args, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
        if (err) {
          // include stderr to debug ffmpeg failures
          return res.status(500).send(`ffmpeg error: ${err}\n\nstderr:\n${stderr || ""}`);
        }

        // send file reliably
        res.download(outPath, "final.mp4", (downloadErr) => {
          if (downloadErr) {
            return; // response already handled
          }
          // best-effort cleanup
          fs.unlink(outPath, () => {});
          fs.unlink(bgPath, () => {});
          fs.unlink(audioPath, () => {});
          fs.unlink(subsPath, () => {});
        });
      });
    } catch (e) {
      res.status(500).send(String(e));
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
