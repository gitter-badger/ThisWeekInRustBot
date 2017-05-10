const { resolve } = require('path')
const cheerio = require('cheerio')
const axios = require('axios').default
const R = require('ramda')
const { readFile, writeFile } = require('pify')(require('fs'))

const TOKEN = process.env.TOKEN
const URL_BASE = 'https://this-week-in-rust.org/'
const FILE_NAME = resolve(__dirname, 'lastId.txt')
const TG_SEND = `https://api.telegram.org/bot${TOKEN}/sendMessage`
const CHAT_ID = '@this_week_in_rust'

let latestId = 0

const saveId = () => (
  writeFile(FILE_NAME, latestId),
  console.log('saved latest id', latestId)
)
const message = R.curry(({ link, text }) => `${text}\n\n${link}`)
const sendPost = R.curry((text) => axios.post(TG_SEND, { chat_id: CHAT_ID, text, parse_mode: 'HTML' }))
// const sendPost = R.curry((text) => Promise.resolve({ data: text }))

const attr = R.curry((name, el) => cheerio(el).attr(name))
const mapOver = R.curry((path, fn, el) => el(path).map(R.flip(fn)).get())
const toInt = R.flip(parseInt)

const getIdFromLink = R.pipe(
  R.split('-'),
  R.last,
  R.replace('\/', ''),
  toInt(10)
)

readFile(FILE_NAME, 'utf8')
  .then(content => {
    latestId = toInt(10, content)
    console.log('loaded latest id', latestId)
  }, saveId)
  .then(() => axios.get(URL_BASE))

  // fetch posts
  .then(R.pipe(
    R.prop('data'),
    cheerio.load,
    mapOver('.row.post-title a', attr('href')),

    // select post link and id
    R.map(
      R.converge(
        (link, id) => ({ link, id }),
        [e => e, getIdFromLink]
      )
    ),

    // load only new
    R.filter(
      R.pipe(
        R.prop('id'),
        id => id > latestId
      )
    ),

    // update latestId and fetch each post
    R.map(i => (
      latestId = i.id > latestId ? i.id : latestId,
      axios.get(i.link)
    ))
  ))
  .then(all => Promise.all(all))
  .then(R.tap(list => (list || []).map(it => it.request.responseURL).forEach(e => console.log('fetched:', e))))

  // fetch links from each post
  .then(R.map(R.pipe(
    R.prop('data'),
    cheerio.load,
    $ => $('.page-content .post-content ul')
      .first()
      .find('li a')
      .map(R.flip(cheerio))
      .get(),
    R.map(e => ({ text: e.text(), link: e.attr('href') }))
  )))
  .then(R.flatten)
  .then(R.map(R.pipe(
    message,
    sendPost
  )))
  .then(e => Promise.all(e))
  .catch(e => console.warn(e))
  .then(R.pluck('data'))
  .then(saveId)

