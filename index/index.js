//const util = require('util');
const elasticsearch = require('elasticsearch');
const dimensionRegex = /^\s*([0-9]+)\s*(mm|cm|m)\s*$/;
const index = 'products';
const fs = require('fs');
const path = require('path');
const process = require('process');


try {
  if (fs.existsSync('./data/i')) {
    waitForElastic('./data');
    fs.unlinkSync('./data/i');
  }
}
catch (error) {
  console.log(error);
  process.exitCode = 1;
}

async function waitForElastic(dataPath) {
  const client = new elasticsearch.Client({
    host: 'elastic:9200'
  });
  while (true) {
    try {
      await client.info();
      break;
    }
    catch (error) {
    }
  }
  indexData(dataPath);
}

async function indexData(dataPath) {
  let products = [];
  let files = fs.readdirSync(dataPath)
  console.log(files);

  for (let i in files) {
    if (files[i].slice(-5) === '.json') {
      let stark = require('./' + path.join(dataPath, files[i]));
      products.push(...stark.Products);
    }
  }

  const client = new elasticsearch.Client({
    host: 'elastic:9200'
    //, log: 'trace'
  });

  try {
    await client.indices.delete({
      index: index
    });
  }
  catch (error) {
    console.log(error);
  }

  await client.indices.create({
    index: index,
    body: {
      number_of_replicas: 0,
      'index.mapping.total_fields.limit': 10000
    }
  });

  let esBulk = {
    body: []
  };

  for (let i in products) {
    let product = products[i];
    let variants = product.Variants;
    for (let j in variants) {
      let variant = variants[j];
      let esVariant = {
        Id: variant.Id,
        URL: variant.Url,
        Titel: variant.BrowserTitle,
        KortTitel: variant.Title,
        KortBeskrivelse: variant.ShortDescription,
        LangBeskrivelse: variant.LongDescription,
        Enhed: variant.Unit,
        NormalPris: variant.PrimaryPriceInclVat,
        Billede: variant.MainImage.AbsoluteUrl,
      };
      if (esVariant.Billede == undefined) {
        esVariant.Billede = "https://resources-stark.impactlive.net/noimage.png";
        console.log("No image!");
      }
      let memberPrice = variant.SecondaryPriceInclVatFormatted;
      if (memberPrice) {
        MedlemsPris = parseFloat(variant.SecondaryPriceInclVatFormatted.replace('.', '').replace(',', '.'));
        MedlemsRabat = (variant.PrimaryPriceInclVat - MedlemsPris) / variant.PrimaryPriceInclVat;
        esVariant.MedlemsPris = MedlemsPris;
        esVariant.MedlemsRabat = MedlemsRabat;
      }
      addAllAttributes(variant.AllDescriptiveAttributes, esVariant);
      addAllAttributes(variant.AllDefiningAttributes, esVariant);
      addAllAttributes(variant.VariantDescriptiveAttributes, esVariant);
      esBulk.body.push(
        { index: { _index: index, _type: 'product' } },
        esVariant
      );
    }
  }
  try {
    await client.bulk(esBulk);
  }
  catch (error) {
    console.log(error);
  }
}

function addAllAttributes(attributes, esVariant) {
  for (let i in attributes) {
    let attributeValue = attributes[i][0];
    let match = attributeValue.match(dimensionRegex);
    if (match) {
      esVariant[i + '-Værdi'] = parseFloat(match[1].replace('.', '').replace(',', '.'));
      esVariant[i + '-Enhed'] = match[2];
    }
    /*else {
      let floatValue = parseFloat(attributes[i][0]);
      if (floatValue) {
        attributeValue = floatValue;
        //console.log('Parsed ' + attributeValue + ' as float.');
      }
      else {
        //console.log('Could not parse ' + attributeValue + ' as float.');
      }
    }*/
    esVariant[i] = attributeValue;
  }
}