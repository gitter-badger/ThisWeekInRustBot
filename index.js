const cheerio = require('cheerio')
const axios = require('axios').default
const R = require('ramda')

const URL_BASE = 'https://this-week-in-rust.org/'

const attr = R.curry((name, el) => cheerio(el).attr(name))
const mapOver = R.curry((path, fn, el) => el(path).map(R.flip(fn)).get())
const toInt = R.flip(parseInt)

axios.get(URL_BASE)
  .then(R.pipe(
    R.prop('data'),
    cheerio.load,
    mapOver('.row.post-title a', attr('href')),
    R.map(R.pipe(
      R.split('-'),
      R.last,
      R.replace('\/', ''),
      toInt(10)
    )),
    R.tap(console.log)
  ))
