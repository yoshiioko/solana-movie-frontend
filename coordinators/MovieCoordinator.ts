import bs58 from "bs58"
import * as web3 from "@solana/web3.js"
import { Movie } from "../models/Movie"
import { MOVIE_REVIEW_PROGRAM_ID } from "../utils/constants"

export class MovieCoordinator {
    static accounts: web3.PublicKey[] = []

    static async prefetchAccounts(connection: web3.Connection, search: string) {
        const accounts = await connection.getProgramAccounts(
          new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
          {
            dataSlice: { offset: 0, length: 4 + 6 + 1 + 32 + 1 + 4 + 20 },
            filters:
              search === ""
                ? [
                    {
                      memcmp: {
                        offset: 4,
                        bytes: bs58.encode(Buffer.from("review")),
                      },
                    },
                  ]
                : [
                    {
                      memcmp: {
                        offset: 4 + 6 + 1 + 32 + 1 + 4,
                        bytes: bs58.encode(Buffer.from(search)),
                      },
                    },
                  ],
          }
        );

        accounts.sort((a, b) => {
            const lengthA = a.account.data.readUInt32LE(41)
            const lengthB = b.account.data.readUInt32LE(41)
            const dataA = a.account.data.slice(4, 4 + lengthA)
            console.log("a", dataA)
            const dataB = b.account.data.slice(4, 4 + lengthB)
            console.log("b", dataB)
            return dataA.compare(dataB)
        })

        console.log("accounts", accounts)

        this.accounts = accounts.map((account) => account.pubkey)
    }

    static async fetchPage(
        connection: web3.Connection,
        page: number,
        perPage: number,
        search: string,
        reload: boolean = false
    ): Promise<Movie[]> {
        if (this.accounts.length === 0 || reload) {
            await this.prefetchAccounts(connection, search)
        }

        const paginatedPublicKeys = this.accounts.slice(
            (page - 1) * perPage,
            page * perPage
        )

        if (paginatedPublicKeys.length === 0) {
            return []
        }

        const accounts = await connection.getMultipleAccountsInfo(
            paginatedPublicKeys
        )

        const movies = accounts.reduce((accum: Movie[], account) => {
            const movie = Movie.deserialize(account?.data)
            if (!movie) {
                return accum
            }

            return [...accum, movie]
        }, [])

        return movies
    }
}