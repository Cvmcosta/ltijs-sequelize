"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _classPrivateFieldSet2 = _interopRequireDefault(require("@babel/runtime/helpers/classPrivateFieldSet"));

var _classPrivateFieldGet2 = _interopRequireDefault(require("@babel/runtime/helpers/classPrivateFieldGet"));

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

const provDatabaseDebug = require('debug')('provider:database');

const crypto = require('crypto');

const Sequelize = require('sequelize');

const cron = require('node-cron');

const {
  Umzug,
  SequelizeStorage
} = require('umzug');

const path = require('path');
/**
 * @description Collection of methods to manipulate the database.
 */


var _sequelize = /*#__PURE__*/new WeakMap();

var _Models = /*#__PURE__*/new WeakMap();

var _deploy = /*#__PURE__*/new WeakMap();

var _dialect = /*#__PURE__*/new WeakMap();

var _cronJob = /*#__PURE__*/new WeakMap();

var _ExpireTime = /*#__PURE__*/new WeakMap();

var _databaseCleanup = /*#__PURE__*/new WeakMap();

class Database {
  /**
   * @description Sequelize plugin constructor
   * @param {String} database - Database name
   * @param {String} user - Auth user
   * @param {String} pass - Auth password
   * @param {Object} options - Sequelize options
   */
  constructor(database, user, pass, options) {
    _sequelize.set(this, {
      writable: true,
      value: void 0
    });

    _Models.set(this, {
      writable: true,
      value: void 0
    });

    _deploy.set(this, {
      writable: true,
      value: false
    });

    _dialect.set(this, {
      writable: true,
      value: void 0
    });

    _cronJob.set(this, {
      writable: true,
      value: void 0
    });

    _ExpireTime.set(this, {
      writable: true,
      value: {
        idtoken: 3600 * 24 * 1000,
        contexttoken: 3600 * 24 * 1000,
        accesstoken: 3600 * 1000,
        nonce: 10 * 1000,
        state: 600 * 1000
      }
    });

    _databaseCleanup.set(this, {
      writable: true,
      value: async () => {
        provDatabaseDebug('Cleaning up expired records ...');
        let res;
        res = await (0, _classPrivateFieldGet2.default)(this, _Models).idtoken.destroy({
          where: {
            createdAt: {
              [Sequelize.Op.lte]: Date.now() - (0, _classPrivateFieldGet2.default)(this, _ExpireTime).idtoken
            }
          }
        });
        provDatabaseDebug('Expired idtoken: ' + res);
        res = await (0, _classPrivateFieldGet2.default)(this, _Models).contexttoken.destroy({
          where: {
            createdAt: {
              [Sequelize.Op.lte]: Date.now() - (0, _classPrivateFieldGet2.default)(this, _ExpireTime).contexttoken
            }
          }
        });
        provDatabaseDebug('Expired contexttoken: ' + res);
        res = await (0, _classPrivateFieldGet2.default)(this, _Models).accesstoken.destroy({
          where: {
            createdAt: {
              [Sequelize.Op.lte]: Date.now() - (0, _classPrivateFieldGet2.default)(this, _ExpireTime).accesstoken
            }
          }
        });
        provDatabaseDebug('Expired accesstoken: ' + res);
        res = await (0, _classPrivateFieldGet2.default)(this, _Models).nonce.destroy({
          where: {
            createdAt: {
              [Sequelize.Op.lte]: Date.now() - (0, _classPrivateFieldGet2.default)(this, _ExpireTime).nonce
            }
          }
        });
        provDatabaseDebug('Expired nonce: ' + res);
        res = await (0, _classPrivateFieldGet2.default)(this, _Models).state.destroy({
          where: {
            createdAt: {
              [Sequelize.Op.lte]: Date.now() - (0, _classPrivateFieldGet2.default)(this, _ExpireTime).state
            }
          }
        });
        provDatabaseDebug('Expired state: ' + res);
      }
    });

    (0, _classPrivateFieldSet2.default)(this, _sequelize, new Sequelize(database, user, pass, options));
    (0, _classPrivateFieldSet2.default)(this, _dialect, options.dialect);
    (0, _classPrivateFieldSet2.default)(this, _Models, {
      idtoken: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('idtoken', {
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
      contexttoken: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('contexttoken', {
        contextId: {
          type: Sequelize.TEXT
        },
        path: {
          type: Sequelize.TEXT
        },
        user: {
          type: Sequelize.TEXT
        },
        roles: (0, _classPrivateFieldGet2.default)(this, _dialect) === 'postgres' ? {
          type: Sequelize.ARRAY(Sequelize.TEXT)
        } : {
          type: Sequelize.TEXT,

          get() {
            // eslint-disable-line
            const roles = this.getDataValue('roles');
            if (roles) return roles.split(';');
            return null;
          },

          set(val) {
            // eslint-disable-line
            if (val) this.setDataValue('roles', val.join(';'));else this.setDataValue('roles', null);
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
      platform: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('platform', {
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
      platformStatus: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('platformStatus', {
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
      publickey: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('publickey', {
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
      privatekey: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('privatekey', {
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
      accesstoken: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('accesstoken', {
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
      nonce: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('nonce', {
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
      state: (0, _classPrivateFieldGet2.default)(this, _sequelize).define('state', {
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
    });
    this.db = (0, _classPrivateFieldGet2.default)(this, _sequelize);
  }
  /**
   * @description Opens connection to database
   */


  async setup() {
    provDatabaseDebug('Using Sequelize Database Plugin - Cvmcosta');
    provDatabaseDebug('Dialect: ' + (0, _classPrivateFieldGet2.default)(this, _dialect));
    const sequelize = (0, _classPrivateFieldGet2.default)(this, _sequelize);
    await sequelize.authenticate(); // Sync models to database, creating tables if they do not exist

    await sequelize.sync(); // Run migrations

    provDatabaseDebug('Performing migrations');
    const umzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, 'migrations') + '/*.js'
      },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({
        sequelize
      }),
      logger: console
    });
    await umzug.up(); // Setting up database cleanup cron jobs

    await (0, _classPrivateFieldGet2.default)(this, _databaseCleanup).call(this);
    (0, _classPrivateFieldSet2.default)(this, _cronJob, cron.schedule('0 */1 * * *', async () => {
      await (0, _classPrivateFieldGet2.default)(this, _databaseCleanup).call(this);
    }));
    (0, _classPrivateFieldGet2.default)(this, _cronJob).start();
    (0, _classPrivateFieldSet2.default)(this, _deploy, true);
    return true;
  } // Closes connection to the database


  async Close() {
    // Stopping cronjobs and connection to postgresql
    if ((0, _classPrivateFieldGet2.default)(this, _cronJob)) {
      provDatabaseDebug('Stopping and removing cronjob');
      (0, _classPrivateFieldGet2.default)(this, _cronJob).stop();
      (0, _classPrivateFieldSet2.default)(this, _cronJob, null);
    }

    provDatabaseDebug('Closing connection to database');
    await (0, _classPrivateFieldGet2.default)(this, _sequelize).close();
    (0, _classPrivateFieldSet2.default)(this, _deploy, false);
    provDatabaseDebug('Closed database connection and removed cronjob');
    return true;
  }
  /**
     * @description Get item or entire database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none
     * @param {String} table - The name of the table from where to query
     * @param {Object} [info] - Info for the item being searched for in the format {col1: "value1"}.
     */


  async Get(ENCRYPTIONKEY, table, info) {
    if (!(0, _classPrivateFieldGet2.default)(this, _deploy)) throw new Error('PROVIDER_NOT_DEPLOYED');
    if (!table) throw new Error('MISSING_PARAMETER');
    const queryResult = await (0, _classPrivateFieldGet2.default)(this, _Models)[table].findAll({
      where: info
    });
    const result = [];

    for (let item of queryResult) {
      if (table === 'accesstoken' || table === 'idtoken' || table === 'contexttoken' || table === 'nonce') {
        const createdAt = Date.parse(item.createdAt);
        const elapsedTime = Date.now() - createdAt;

        if (elapsedTime >= (0, _classPrivateFieldGet2.default)(this, _ExpireTime)[table]) {
          item.destroy();
          continue;
        }
      }

      item = item.toJSON();

      if (ENCRYPTIONKEY) {
        const temp = item;
        item = JSON.parse(await this.Decrypt(item.data, item.iv, ENCRYPTIONKEY));

        if (temp.createdAt) {
          const createdAt = Date.parse(temp.createdAt);
          item.createdAt = createdAt;
        }
      }

      result.push(item);
    } // Check if query was successful


    if (result.length === 0) return false;
    return result;
  }
  /**
     * @description Insert item in database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} table - The name of the table from where to query
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */


  async Insert(ENCRYPTIONKEY, table, item, index) {
    if (!(0, _classPrivateFieldGet2.default)(this, _deploy)) throw new Error('PROVIDER_NOT_DEPLOYED');
    if (!table || !item || ENCRYPTIONKEY && !index) throw new Error('MISSING_PARAMS'); // Encrypt if encryption key is present

    let newDocData = item;

    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY);
      newDocData = _objectSpread(_objectSpread({}, index), {}, {
        iv: encrypted.iv,
        data: encrypted.data
      });
    }

    await (0, _classPrivateFieldGet2.default)(this, _Models)[table].create(newDocData);
    return true;
  }
  /**
   * @description Insert item in database.
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
   * @param {String} table - The name of the table from where to query
   * @param {Object} info - Info for the item being searched for in the format {col1: "value1"}.
   * @param {Object} item - The item Object you want to insert in the database.
   * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
   */


  async Replace(ENCRYPTIONKEY, table, info, item, index) {
    if (!(0, _classPrivateFieldGet2.default)(this, _deploy)) throw new Error('PROVIDER_NOT_DEPLOYED');
    if (!table || !item || ENCRYPTIONKEY && !index) throw new Error('MISSING_PARAMS');
    await this.Delete(table, info); // Encrypt if encryption key is present

    let newDocData = item;

    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY);
      newDocData = _objectSpread(_objectSpread({}, index), {}, {
        iv: encrypted.iv,
        data: encrypted.data
      });
    }

    await (0, _classPrivateFieldGet2.default)(this, _Models)[table].create(newDocData);
    return true;
  }
  /**
     * @description Assign value to item in database
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} table - The name of the table from where to query
     * @param {Object} info - Info for the item being modified in the format {col1: "value1"}.
     * @param {Object} modification - The modification you want to make in the format {col1: "value2"}.
     */


  async Modify(ENCRYPTIONKEY, table, info, modification) {
    if (!(0, _classPrivateFieldGet2.default)(this, _deploy)) throw new Error('PROVIDER_NOT_DEPLOYED'); // Parameter check

    if (!table || !info || !modification) throw new Error('MISSING_PARAMS'); // Encrypt if encryption key is present

    let newMod = modification;

    if (ENCRYPTIONKEY) {
      let result = await (0, _classPrivateFieldGet2.default)(this, _Models)[table].findOne({
        where: info,
        raw: true
      });

      if (result) {
        result = JSON.parse(await this.Decrypt(result.data, result.iv, ENCRYPTIONKEY));
        result[Object.keys(modification)[0]] = Object.values(modification)[0];
        newMod = await this.Encrypt(JSON.stringify(result), ENCRYPTIONKEY);
      }
    }

    await (0, _classPrivateFieldGet2.default)(this, _Models)[table].update(newMod, {
      where: info
    });
    return true;
  }
  /**
     * @description Delete item in database
     * @param {String} table - The name of the table from where to query
     * @param {Object} [info] - Info for the item being deleted in the format {col1: "value1"}.
     */


  async Delete(table, info) {
    if (!(0, _classPrivateFieldGet2.default)(this, _deploy)) throw new Error('PROVIDER_NOT_DEPLOYED'); // Parameter check

    if (!table || !info) throw new Error('Missing argument.');
    await (0, _classPrivateFieldGet2.default)(this, _Models)[table].destroy({
      where: info
    });
    return true;
  }
  /**
   * @description Encrypts data.
   * @param {String} data - Data to be encrypted
   * @param {String} secret - Secret used in the encryption
   */


  async Encrypt(data, secret) {
    const hash = crypto.createHash('sha256');
    hash.update(secret);
    const key = hash.digest().slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex')
    };
  }
  /**
   * @description Decrypts data.
   * @param {String} data - Data to be decrypted
   * @param {String} _iv - Encryption iv
   * @param {String} secret - Secret used in the encryption
   */


  async Decrypt(data, _iv, secret) {
    const hash = crypto.createHash('sha256');
    hash.update(secret);
    const key = hash.digest().slice(0, 32);
    const iv = Buffer.from(_iv, 'hex');
    const encryptedText = Buffer.from(data, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

}

module.exports = Database;