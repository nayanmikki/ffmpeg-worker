const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

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
    const bg = req.files.background[0].path;
    const audio = req.files.audio[0].path;
    const subs = req.files.subs[0].path;
    const out = "/tmp/final.mp4";

    const cmd = `ffmpeg -y -i "${bg}" -i "${audio}" -vf "subtitles=${subs}" -c:v libx264 -c:a aac -shortest "${out}"`;

    exec(cmd, (err) => {
      if (err) return res.status(500).send(err.message);
      res.sendFile(out);
    });
  }
);

app.listen(process.env.PORT || 3000);
