const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const upload = multer({ dest: "/tmp" });

app.post(
  "/render",
  upload.fields([
    { name: "background", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "subs", maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const bg = req.files.background[0].path;
      const audio = req.files.audio[0].path;
      const subs = req.files.subs[0].path;
      const out = "/tmp/final.mp4";

      const args = [
        "-y",
        "-i", bg,
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
      res.status(400).send("Missing files: background, audio, subs");
    }
  }
);

app.listen(process.env.PORT || 3000);
