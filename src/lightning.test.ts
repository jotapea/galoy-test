import { LightningWalletAuthed } from "./lightningImpl"
import moment from "moment"
import { createHashUser, setupMongoose } from "./db"
var lightningPayReq = require('bolt11')
const mongoose = require("mongoose");


let lightningWallet


const user1 = "user1"
const user2 = "user2"


beforeAll(async () => {
  await setupMongoose()

  // FIXME: this might cause issue when running test in parrallel?
  return await mongoose.connection.dropDatabase()
});


beforeEach(async () => {
  lightningWallet = new LightningWalletAuthed({uid: user1})


  // // example for @kartik
  // const {lnd2} = lnService.authenticatedLndGrpc({
  //   cert: 'base64 encoded tls.cert',
  //   macaroon: 'base64 encoded admin.macaroon',
  //   socket: 'lnd-container-devnet1:10009',
  // });

  // lnService.createInvoice({lnd: lnd2, amoint... })
  // lnService.pay({lnd: lnd2, amoint... })

})

it('Lightning Wallet Get Info works', async () => {
  const result = await lightningWallet.getInfo()
  console.log({result})
  // expect(result === 0).toBeTruthy()
})


it('add invoice', async () => {
  const { request } = await lightningWallet.addInvoice({value: 1000, memo: "tx 1"})
  expect(request.startsWith("lntb10")).toBeTruthy()

  const decoded = lightningPayReq.decode(request)
  const decodedHash = decoded.tags.filter(item => item.tagName === "payment_hash")[0].data

  const HashUser = await createHashUser()
  const {user} = await HashUser.findById(decodedHash)

  expect(user).toBe(user1)
})


it('add invoice to different user', async () => {
  lightningWallet = new LightningWalletAuthed({uid: user2})
  const { request } = await lightningWallet.addInvoice({value: 1000000, memo: "tx 2"})

  const decoded = lightningPayReq.decode(request)
  const decodedHash = decoded.tags.filter(item => item.tagName === "payment_hash")[0].data

  const HashUser = await createHashUser()
  const {user} = await HashUser.findById(decodedHash)

  expect(user).toBe(user2)
})



it('list transactions', async () => {

  const result = await lightningWallet.getTransactions()
  expect(result.length).toBe(0) 

  // TODO validate a transaction to be and verify result == 1 afterwards.


  let lastDate = result[0].created_at
  let currentDate

  result.forEach(input => {
    currentDate = moment(input.created_at)

    if (currentDate > lastDate) {
      throw Error("date are not in the correct order")
    }

    lastDate = currentDate
  })

  // TODO more testing with devnet
})

it('get balance', async () => {
  const balance = await lightningWallet.getBalance()
  expect(balance).toBe(0)
})


// it('payInvoice', async () => {
//   // TODO need a way to generate an invoice from another node
// })

// it('payInvoiceToAnotherGaloyUser', async () => {
//   // TODO Manage on us transaction from 2 users of our network
// })

// it('payInvoiceToSelf', async () => {
//   // TODO should fail
// })

// it('pushPayment', async () => {
//   // payment without invoice, lnd 0.9+
// })
