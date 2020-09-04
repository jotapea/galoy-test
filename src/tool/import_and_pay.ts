import { LightningUserWallet } from "../LightningUserWallet"
import { setupMongoConnection, User } from "../mongodb"

const csv = require('csv-parser')
const fs = require('fs')

const getUserWallet = async ({phone}) => {
  console.log({phone})
  const user = await User.findOne({ phone })
  return new LightningUserWallet({ uid: user._id })
}

const payer = "+16505554321"

// source ../../exportLocal.sh && ts-node ./import_and_pay.ts

const main = async () => {
  await setupMongoConnection()

  const payerWallet = await getUserWallet({phone: payer})
  const results: any[] = [];

  fs.createReadStream('records.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(results);

    for (const user of results) {
      if (!!user.Amount) {
        console.log({user})
        const payeeWallet = await getUserWallet({phone: user.Phone})
        const request = await payeeWallet.addInvoice({ value: user.Amount, memo: user.Memo })
        await payerWallet.pay({invoice: request})
        console.log(`payment of ${user.Amount} sats to ${user.Phone} sent succesfully`)
      } else {
        console.log(`no amount for ${user.Phone}, passing`)
      }
    }
  });
}

main().then(o => console.log(o)).catch(err => console.log(err))
console.log("end")