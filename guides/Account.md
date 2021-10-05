Use this module to interact with Helium crypto accounts.

For example creating an account keypair, generating challenge words to confirm users have written down their words, and
get a list of possible account words that match a given substring.

## Import the module

```ts
import { Account } from '@helium/react-native-sdk'
```

## Create a Keypair

Create a keypair from a random mnemonic. A [mnemonic](https://en.bitcoin.it/wiki/Seed_phrase), or seed phrase, is a list
of 12 [BIP 39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) words. The Mnemonic can be used to restore
the account keypair. Creating the keypair returns its private key (keypairRaw), public key (address), and its mnemonic.

```ts
const { keypairRaw, address, mnemonic } = await Account.createKeypair()
```

You could also use a mnemonic to restore a keypair. The word order is important and needs to remain the same to generate the same keypair.

```ts
const givenMnemonic = ["witch", "collapse", "practice", "feed", "shame", "open", "despai", "creek", "road", "again", "ice", "least"]
const { keypairRaw, address, mnemonic } = await Account.createKeypair(givenMnemonic)
```

## Generate Challenge Words

If you need to confirm a user knows their words, you can use this to challenge each of their 12 words. It will generate
a list of words to challenge the target word.

```ts
const targetWord = "collapse"
const words = await Account.generateChallengeWords(targetWord)
```

`words` would contain an array of [BIP 39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) words one of
which being the target word.

## Get Matching Words

If you want to auto complete a list of words as a user types you can use `Account.getMatchingWords`. For example when
restoring a users 12 words you may want to use this as they type there words so that they can select the word as they
type and quickly fill in 12 words.

```ts
const text = "coll"
const words = await Account.getMatchingWords(text)
```

`words` would contain an array of [BIP 39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) words that
contain the substring "coll".


