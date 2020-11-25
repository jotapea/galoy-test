import { DbVersion } from "./mongodb";
import { Price } from "./priceImpl";
import { baseLogger } from "./utils";

const NodeCache = require( "node-cache" );
export const mainCache = new NodeCache();


export const getLastPrice = async (): Promise<number> => {
  const key = "lastPrices"
  let lastPrice

  lastPrice = mainCache.get(key);
  if ( lastPrice === undefined ){
    lastPrice = await new Price({ logger: baseLogger }).lastPrice()
    mainCache.set( key, lastPrice, [ 300 ] )
  }

  return lastPrice
}

export const getMinBuildNumber = async () => {
  const key = "minBuildNumber"
  let value

  value = mainCache.get(key);
  if ( value === undefined ){
    const { minBuildNumber, lastBuildNumber } = await DbVersion.findOne({}, { minBuildNumber: 1, lastBuildNumber: 1, _id: 0 })
    mainCache.set( key, { minBuildNumber, lastBuildNumber }, [ 3600 ] )
    value = { minBuildNumber, lastBuildNumber }
  }

  return value
}