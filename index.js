const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const https = require("https");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "/tmp" });

function downloadToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

app.post(
  "/render",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "subs", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const backgroundUrl = req.body.background_url;
      if (!backgroundUrl) return res.status(400).send("Missing background_url");

      const bgPath = "/tmp/background.mp4";
      await downloadToFile(backgroundUrl, bgPath);

      const audio = req.files.audio[0].path;
      const subs = req.files.subs[0].path;
      const out = "/tmp/final.mp4";

      const args = [
        "-y",
        "-i", bgPath,
        "-i", audio,
        "-vf", `subtitles=${subs}`,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        out
      ];

      execFile(ffmpegPath, args, (err) => {
        if (err) return res.status(500).send(String(err));
        res.sendFile(out);
      });
    } catch (e) {
      res.status(500).send(String(e));
    }
  }
);

app.listen(process.env.PORT || 3000);
