import { bitcoindAccountingPath, customerPath, lightningAccountingPath, lndFee } from "./ledger";
import { MainBook } from "./mongodb";
import { OnChainMixin } from "./OnChain";
import { BitcoindClient, btc2sat, getAuth, sat2btc } from "./utils";
import { UserWallet } from "./wallet";

export class SpecterWallet extends OnChainMixin(UserWallet) {
  readonly currency = "BTC"
  bitcoindClient 
  wallet = "coldstorage"

  get accountPath(): string {
    return customerPath(this.uid)
  }

  constructor({ uid, user, logger, lastPrice }) {
    super({ uid, user, logger, currency: "BTC", lastPrice })
    this.logger = logger.child({ topic: "bitcoind" })

    this.bitcoindClient = BitcoindClient({wallet: this.wallet})
  }

  async createDepositAddress() {
    return this.bitcoindClient.getNewAddress()
  }

  // for debugging
  // to create the wallet from bitcoin-cli:
  // bitcoin-cli --named createwallet wallet_name="coldstorage" disable_private_keys="true"
  // 
  // more info on: 
  // https://github.com/BlockchainCommons/Learning-Bitcoin-from-the-Command-Line/blob/master/07_3_Integrating_with_Hardware_Wallets.md

  // to import a descriptor:
  // https://github.com/BlockchainCommons/Learning-Bitcoin-from-the-Command-Line/blob/master/03_5_Understanding_the_Descriptor.md
  // bitcoin-cli importmulti `${descriptor}`

  async createWallet() {
    return this.bitcoindClient.createWallet({wallet_name: "coldstorage"})
  }

  async listWallets() {
    return this.bitcoindClient.listWallets()
  }




  async getAddressInfo({address}) {
    return this.bitcoindClient.getAddressInfo({address})
  }

  async getBitcoindBalance() {
    return btc2sat(await this.bitcoindClient.getBalance())
  }

  static isRebalanceNeeded({ }) {
    // TODO
  }

  async toColdStorage({ sats }) {
    const currency = this.currency

    const address = await this.createDepositAddress()

    // FIXME: we are crediting the account first because 
    // otherwise the balance will be negative
    // FIXME: estimating the fee is not a good idea here. use actual fees.
    const lnService = require('ln-service');
    const { lnd } = lnService.authenticatedLndGrpc(getAuth())
    
    // FIXME: fee are an estimate. may not be what is actually paid
    const { fee } = await lnService.getChainFeeEstimate({ lnd, send_to: [{ address, tokens: sats }] })

    const metadata = { type: "to_cold_storage", currency, ...this.getCurrencyEquivalent({sats, fee}), pending: false }
    
    const memo = `deposit of ${sats} sats to the cold storage wallet`

    // onChainPay is doing:
    //
    // await MainBook.entry(memo)
    // .debit(lightningAccountingPath, sats + fee, metadata)
    // .credit(this.accountPath, sats + fee, metadata)
    // .commit()
    //
    // we're doing 2 transactions here on medici.
    // explore a way to refactor this to make a single transaction.

    
    await MainBook.entry()
      .debit(this.accountPath, sats + fee, {...metadata, memo })
      .credit(lndFee, fee, {...metadata, memo })
      .credit(bitcoindAccountingPath, sats, {...metadata, memo })
      .commit()

    try {
      await this.onChainPay({ address, amount: sats, memo })
    } catch (err) {
      this.logger.fatal({err}, "could not send to deposit. accounting to be reverted")
    }

    this.logger.info({...metadata, currency, sats, memo, address}, "deposit rebalancing succesful")
  }

  async toLndWallet ({ sats }) {
    const currency = this.currency

    const metadata = { type: "to_hot_wallet", currency, ...this.getCurrencyEquivalent({sats, fee: 0}), pending: false }
    let subLogger = this.logger.child({...metadata, currency, sats })

    const memo = `withdrawal of ${sats} sats from ${this.wallet} bitcoind wallet`

    const address = await this.getLastOnChainAddress()

    let withdrawalResult

    subLogger = subLogger.child({memo, address})

    try {
      // TODO: won't work automatically with a cold storage wallet
      // make a PSBT instead accesible for further signing.
      // TODO: figure out a way to export the PSBT when there is a pending tx
      withdrawalResult = await this.bitcoindClient.sendToAddress(address, sat2btc(sats))
    } catch(err) {
      const error = "this.bitcoindClient.sendToAddress() error"
      subLogger.error({withdrawalResult}, error)
      throw new Error(err)
    }

    // TODO
    const success = true

    if (success) {

      await MainBook.entry()
      .debit(lightningAccountingPath, sats, {...metadata, memo })
      .credit(bitcoindAccountingPath, sats, {...metadata, memo })
      .commit()

      subLogger.info({withdrawalResult}, `rebalancing withdrawal was succesful`)

    } else {
      subLogger.error({withdrawalResult}, `rebalancing withdrawal was not succesful`)
    }

  } 
}