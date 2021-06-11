const provDatabaseDebug = require('debug')('provider:database')
const crypto = require('crypto')
const Sequelize = require('sequelize')
const cron = require('node-cron')
const { Umzug, SequelizeStorage } = require('umzug')
const path = require('path')

/**
 * @description Collection of methods to manipulate the database.
 */
class Database {
  #sequelize

  #Models

  #deploy = false

  #dialect

  #cronJob

  #ExpireTime = {
    idtoken: 3600 * 24 * 1000,
    contexttoken: 3600 * 24 * 1000,
    accesstoken: 3600 * 1000,
    nonce: 10 * 1000,
    state: 600 * 1000
  }

  #databaseCleanup = async () => {
    provDatabaseDebug('Cleaning up expired records ...')
    let res
    res = await this.#Models.idtoken.destroy({ where: { createdAt: { [Sequelize.Op.lte]: Date.now() - (this.#ExpireTime.idtoken) } } })
    provDatabaseDebug('Expired idtoken: ' + res)

    res = await this.#Models.contexttoken.destroy({ where: { createdAt: { [Sequelize.Op.lte]: Date.now() - (this.#ExpireTime.contexttoken) } } })
    provDatabaseDebug('Expired contexttoken: ' + res)

    res = await this.#Models.accesstoken.destroy({ where: { createdAt: { [Sequelize.Op.lte]: Date.now() - (this.#ExpireTime.accesstoken) } } })
    provDatabaseDebug('Expired accesstoken: ' + res)

    res = await this.#Models.nonce.destroy({ where: { createdAt: { [Sequelize.Op.lte]: Date.now() - (this.#ExpireTime.nonce) } } })
    provDatabaseDebug('Expired nonce: ' + res)

    res = await this.#Models.state.destroy({ where: { createdAt: { [Sequelize.Op.lte]: Date.now() - (this.#ExpireTime.state) } } })
    provDatabaseDebug('Expired state: ' + res)
  }

  /**
   * @description Sequelize plugin constructor
   * @param {String} database - Database name
   * @param {String} user - Auth user
   * @param {String} pass - Auth password
   * @param {Object} options - Sequelize options
   */
  constructor (database, user, pass, options) {
    this.#sequelize = new Sequelize(database, user, pass, options)
    this.#dialect = options.dialect
    this.#Models = {
      idtoken: this.#sequelize.define('idtoken', {
        iss: {
          type: Sequelize.TEXT
        },
        platformId: {
          type: Sequelize.TEXT
        },
        clientId: {
          type: Sequelize.TEXT
        },
        deploymentId: {
          type: Sequelize.TEXT
        },
        user: {
          type: Sequelize.TEXT
        },
        userInfo: {
          type: Sequelize.JSON
        },
        platformInfo: {
          type: Sequelize.JSON
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'iss',
            length: 50
          }, {
            attribute: 'clientId',
            length: 50
          }, {
            attribute: 'deploymentId',
            length: 50
          }, {
            attribute: 'user',
            length: 50
          }]
        }, {
          fields: ['createdAt']
        }]
      }),
      contexttoken: this.#sequelize.define('contexttoken', {
        contextId: {
          type: Sequelize.TEXT
        },
        path: {
          type: Sequelize.TEXT
        },
        user: {
          type: Sequelize.TEXT
        },
        roles: this.#dialect === 'postgres'
          ? { type: Sequelize.ARRAY(Sequelize.TEXT) }
          : {
              type: Sequelize.TEXT,
              get() { // eslint-disable-line
                const roles = this.getDataValue('roles')
                if (roles) return roles.split(';')
                return null
              },
              set(val) { // eslint-disable-line
                if (val) this.setDataValue('roles', val.join(';'))
                else this.setDataValue('roles', null)
              }
            },
        targetLinkUri: {
          type: Sequelize.TEXT
        },
        context: {
          type: Sequelize.JSON
        },
        resource: {
          type: Sequelize.JSON
        },
        custom: {
          type: Sequelize.JSON
        },
        endpoint: {
          type: Sequelize.JSON
        },
        namesRoles: {
          type: Sequelize.JSON
        },
        lis: {
          type: Sequelize.JSON
        },
        launchPresentation: {
          type: Sequelize.JSON
        },
        messageType: {
          type: Sequelize.TEXT
        },
        version: {
          type: Sequelize.TEXT
        },
        deepLinkingSettings: {
          type: Sequelize.JSON
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'contextId',
            length: 50
          }, {
            attribute: 'user',
            length: 50
          }]
        }, {
          fields: ['createdAt']
        }]
      }),
      platform: this.#sequelize.define('platform', {
        platformName: {
          type: Sequelize.TEXT
        },
        platformUrl: {
          type: Sequelize.TEXT
        },
        clientId: {
          type: Sequelize.TEXT
        },
        authEndpoint: {
          type: Sequelize.TEXT
        },
        accesstokenEndpoint: {
          type: Sequelize.TEXT
        },
        kid: {
          type: Sequelize.TEXT
        },
        authConfig: {
          type: Sequelize.JSON
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'platformUrl',
            length: 50
          }, {
            attribute: 'clientId',
            length: 50
          }],
          unique: true
        }, {
          fields: [{
            attribute: 'platformUrl',
            length: 50
          }]
        }, {
          fields: [{
            attribute: 'kid',
            length: 50
          }],
          unique: true
        }]
      }),
      platformStatus: this.#sequelize.define('platformStatus', {
        id: {
          type: Sequelize.STRING,
          primaryKey: true
        },
        active: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      }, {
        indexes: [{
          fields: ['id'],
          unique: true
        }]
      }),
      publickey: this.#sequelize.define('publickey', {
        kid: {
          type: Sequelize.STRING,
          primaryKey: true
        },
        platformUrl: {
          type: Sequelize.TEXT
        },
        clientId: {
          type: Sequelize.TEXT
        },
        iv: {
          type: Sequelize.TEXT
        },
        data: {
          type: Sequelize.TEXT
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'kid',
            length: 50
          }],
          unique: true
        }]
      }),
      privatekey: this.#sequelize.define('privatekey', {
        kid: {
          type: Sequelize.STRING,
          primaryKey: true
        },
        platformUrl: {
          type: Sequelize.TEXT
        },
        clientId: {
          type: Sequelize.TEXT
        },
        iv: {
          type: Sequelize.TEXT
        },
        data: {
          type: Sequelize.TEXT
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'kid',
            length: 50
          }],
          unique: true
        }]
      }),
      accesstoken: this.#sequelize.define('accesstoken', {
        platformUrl: {
          type: Sequelize.TEXT
        },
        clientId: {
          type: Sequelize.TEXT
        },
        scopes: {
          type: Sequelize.TEXT
        },
        iv: {
          type: Sequelize.TEXT
        },
        data: {
          type: Sequelize.TEXT
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'platformUrl',
            length: 50
          }, {
            attribute: 'clientId',
            length: 50
          }, {
            attribute: 'scopes',
            length: 50
          }],
          unique: true
        }, {
          fields: ['createdAt']
        }]
      }),
      nonce: this.#sequelize.define('nonce', {
        nonce: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'nonce',
            length: 50
          }],
          unique: true
        }, {
          fields: ['createdAt']
        }]
      }),
      state: this.#sequelize.define('state', {
        state: {
          type: Sequelize.STRING,
          primaryKey: true
        },
        query: {
          type: Sequelize.JSON
        }
      }, {
        indexes: [{
          fields: [{
            attribute: 'state',
            length: 50
          }],
          unique: true
        }, {
          fields: ['createdAt']
        }]
      })
    }

    this.db = this.#sequelize
  }

  /**
   * @description Opens connection to database
   */
  async setup () {
    provDatabaseDebug('Using Sequelize Database Plugin - Cvmcosta')
    provDatabaseDebug('Dialect: ' + this.#dialect)
    const sequelize = this.#sequelize
    await sequelize.authenticate()
    // Sync models to database, creating tables if they do not exist
    await sequelize.sync()
    // Run migrations
    provDatabaseDebug('Performing migrations')
    const umzug = new Umzug({
      migrations: { glob: path.join(__dirname, 'migrations') + '/*.js' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console
    })
    await umzug.up()

    // Setting up database cleanup cron jobs
    await this.#databaseCleanup()
    this.#cronJob = cron.schedule('0 */1 * * *', async () => {
      await this.#databaseCleanup()
    })
    this.#cronJob.start()

    this.#deploy = true
    return true
  }

  // Closes connection to the database
  async Close () {
    // Stopping cronjobs and connection to postgresql
    if (this.#cronJob) {
      provDatabaseDebug('Stopping and removing cronjob')
      this.#cronJob.stop()
      this.#cronJob = null
    }
    provDatabaseDebug('Closing connection to database')
    await this.#sequelize.close()
    this.#deploy = false
    provDatabaseDebug('Closed database connection and removed cronjob')
    return true
  }

  /**
     * @description Get item or entire database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none
     * @param {String} table - The name of the table from where to query
     * @param {Object} [info] - Info for the item being searched for in the format {col1: "value1"}.
     */
  async Get (ENCRYPTIONKEY, table, info) {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!table) throw new Error('MISSING_PARAMETER')

    const queryResult = await this.#Models[table].findAll({ where: info })

    const result = []
    for (let item of queryResult) {
      if (table === 'accesstoken' || table === 'idtoken' || table === 'contexttoken' || table === 'nonce') {
        const createdAt = Date.parse(item.createdAt)
        const elapsedTime = (Date.now() - createdAt)
        if (elapsedTime >= this.#ExpireTime[table]) {
          item.destroy()
          continue
        }
      }
      item = item.toJSON()
      if (ENCRYPTIONKEY) {
        const temp = item
        item = JSON.parse(await this.Decrypt(item.data, item.iv, ENCRYPTIONKEY))
        if (temp.createdAt) {
          const createdAt = Date.parse(temp.createdAt)
          item.createdAt = createdAt
        }
      }
      result.push(item)
    }

    // Check if query was successful
    if (result.length === 0) return false
    return result
  }

  /**
     * @description Insert item in database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} table - The name of the table from where to query
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */
  async Insert (ENCRYPTIONKEY, table, item, index) {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!table || !item || (ENCRYPTIONKEY && !index)) throw new Error('MISSING_PARAMS')

    // Encrypt if encryption key is present
    let newDocData = item
    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY)
      newDocData = {
        ...index,
        iv: encrypted.iv,
        data: encrypted.data
      }
    }

    await this.#Models[table].create(newDocData)
    return true
  }

  /**
   * @description Insert item in database.
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
   * @param {String} table - The name of the table from where to query
   * @param {Object} info - Info for the item being searched for in the format {col1: "value1"}.
   * @param {Object} item - The item Object you want to insert in the database.
   * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
   */
  async Replace (ENCRYPTIONKEY, table, info, item, index) {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!table || !item || (ENCRYPTIONKEY && !index)) throw new Error('MISSING_PARAMS')

    await this.Delete(table, info)
    // Encrypt if encryption key is present
    let newDocData = item
    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY)
      newDocData = {
        ...index,
        iv: encrypted.iv,
        data: encrypted.data
      }
    }

    await this.#Models[table].create(newDocData)
    return true
  }

  /**
     * @description Assign value to item in database
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} table - The name of the table from where to query
     * @param {Object} info - Info for the item being modified in the format {col1: "value1"}.
     * @param {Object} modification - The modification you want to make in the format {col1: "value2"}.
     */
  async Modify (ENCRYPTIONKEY, table, info, modification) {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    // Parameter check
    if (!table || !info || !modification) throw new Error('MISSING_PARAMS')

    // Encrypt if encryption key is present
    let newMod = modification
    if (ENCRYPTIONKEY) {
      let result = await this.#Models[table].findOne({ where: info, raw: true })
      if (result) {
        result = JSON.parse(await this.Decrypt(result.data, result.iv, ENCRYPTIONKEY))
        result[Object.keys(modification)[0]] = Object.values(modification)[0]
        newMod = await this.Encrypt(JSON.stringify(result), ENCRYPTIONKEY)
      }
    }

    await this.#Models[table].update(newMod, { where: info })

    return true
  }

  /**
     * @description Delete item in database
     * @param {String} table - The name of the table from where to query
     * @param {Object} [info] - Info for the item being deleted in the format {col1: "value1"}.
     */
  async Delete (table, info) {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    // Parameter check
    if (!table || !info) throw new Error('Missing argument.')

    await this.#Models[table].destroy({ where: info })

    return true
  }

  /**
   * @description Encrypts data.
   * @param {String} data - Data to be encrypted
   * @param {String} secret - Secret used in the encryption
   */
  async Encrypt (data, secret) {
    const hash = crypto.createHash('sha256')
    hash.update(secret)
    const key = hash.digest().slice(0, 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(data)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
  }

  /**
   * @description Decrypts data.
   * @param {String} data - Data to be decrypted
   * @param {String} _iv - Encryption iv
   * @param {String} secret - Secret used in the encryption
   */
  async Decrypt (data, _iv, secret) {
    const hash = crypto.createHash('sha256')
    hash.update(secret)
    const key = hash.digest().slice(0, 32)
    const iv = Buffer.from(_iv, 'hex')
    const encryptedText = Buffer.from(data, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }
}

module.exports = Database
