'use strict';

const express = require('express');
const app = express();
const resizeImg = require('resize-img');
const fs = require('fs');
const fetch = require('node-fetch');
const imageSize = require('image-size')
const path = require('path');

if (!fs.existsSync('./assets')) {
  fs.mkdirSync('./assets');
}

app.get('/picProxy', getImage);

async function getImage(req, res) {
  const url = req.query.url;
  let filename;
  try {
    let split = url.split('/');
    filename = split[split.length - 1].split('?')[0];
  }
  catch (error) {
    res.send('Blegh.')
    return;
  }
  const fileExtension = path.extname(filename);
  console.log('Requesting file: ' + filename);
  if (!fs.existsSync('./assets/' + filename)) {
    console.log('File does not exist. Retrieving.')
    try {
      let result = await fetch(url);
      let image = await result.buffer();
      if (['.bmp', '.png', '.jpg', '.jpeg'].includes(fileExtension)) {
        const dimensions = imageSize(image);
        const finalWidth = 100;
        const finalHeight = (finalWidth / dimensions.width) * dimensions.height;
        image = await resizeImg(image, { width: finalWidth, height: finalHeight });
      }
      fs.writeFileSync('./assets/' + filename, image);
    }
    catch (error) {
      console.log(error);
      return;
    }
  }
  if (['.eps', '.ps'].includes(fileExtension)) {
    res.download('./assets/noimage.png');
  }
  else {
    res.download('./assets/' + filename);
  }
}

app.listen(80);