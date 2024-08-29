import { ethers } from "ethers"
import { toUpperFirst } from "./Utils"


const DEVICE_EMOJIS = [
  // 256 emojis for unsigned byte range 0 - 255
  ...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐽🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦟🦗🕷🕸🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐈🐓🦃🦚🦜🦢🦩🕊🐇🦝🦨🦡🦦🦥🐁🐀🐿🦔🐾🐉🐲🌵🎄🌲🌳🌴🌱🌿🍀🎍🎋🍃👣🍂🍁🍄🐚🌾💐🌷🌹🥀🌺🌸🌼🌻🌞🌝🍏🍎🍐🍊🍋🍌🍉🍇🍓🍈🥭🍍🥥🥝🍅🥑🥦🥬🥒🌶🌽🥕🧄🧅🥔🍠🥐🥯🍞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥩🍗🍖🦴🌭🍔🍟🍕🥪🥙🧆🌮🌯🥗🥘🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜👀👂👃👄👅👆👇👈👉👊👋👌👍👎👏👐👑👒👓🎯🎰🎱🎲🎳👾👯👺👻👽🏂🏃🏄'
]

export const nameForAddress = (address: string): string => {
  return nameGenerator(address, 2)
}

export const nameGenerator = (seed: string, length: number): string => {
  const wordListSize = 2048
  const words = ethers.wordlists.en

  let output = ''
  let subSeed = ethers.utils.keccak256(seed)
  for (let i = 0; i < length; i++) {
    const index = ethers.BigNumber.from(subSeed).mod(wordListSize).toNumber()
    output = `${words.getWord(index)} ${output}`
    subSeed = ethers.utils.keccak256(subSeed)
  }

  const emojiIndex = ethers.BigNumber.from(subSeed).mod(DEVICE_EMOJIS.length).toNumber()
  return `${DEVICE_EMOJIS[emojiIndex]} ${toUpperFirst(output)}`
}
