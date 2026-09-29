<div align="center">
  <a href="https://github.com/Cvmcosta/ltijs"><img width="300" src="https://raw.githubusercontent.com/Cvmcosta/ltijs/master/website/assets/logo.svg" alt="ltijs"></a>
</div>

> Ltijs Sequelize Database Plugin.

[![Node Version](https://img.shields.io/node/v/ltijs-sequelize.svg)](https://www.npmjs.com/package/ltijs-sequelize)
[![NPM package](https://img.shields.io/npm/v/ltijs-sequelize.svg)](https://www.npmjs.com/package/ltijs-sequelize)
[![NPM downloads](https://img.shields.io/npm/dm/ltijs-sequelize)](https://www.npmjs.com/package/ltijs-sequelize)
[![APACHE2 License](https://img.shields.io/github/license/cvmcosta/ltijs-sequelize)](LICENSE)
[![Donate](https://img.shields.io/badge/Donate-Buy%20me%20a%20coffe-blue)](https://www.buymeacoffee.com/UL5fBsi)

> _Learning Tools Interoperability® (LTI®) is a trademark of the IMS Global Learning Consortium, Inc. (https://www.imsglobal.org)_

> V3.0.0
>
> - Rewritten in TypeScript for [Ltijs v7](https://github.com/Cvmcosta/ltijs), which replaced the old
>   generic `plugin` interface with a typed `DatabaseManager` contract injected directly into `Provider`.
> - Ships two implementations: `SequelizeDatabaseManager`, a fresh schema designed around the new
>   interface, and `SequelizeLegacyDatabaseManager`, which adapts the existing (v2) table layout so
>   deployments upgrading from Ltijs v5/v6 keep their data.
> - **Not compatible with Ltijs v5/v6.** For those, use `ltijs-sequelize@^2`.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
  - [Fresh installs](#fresh-installs---sequelizedatabasemanager)
  - [Upgrading from v2](#upgrading-from-v2---sequelizelegacydatabasemanager)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

This package allows [Ltijs](https://cvmcosta.github.io/ltijs) v7 to work with the databases supported by [Sequelize](https://sequelize.org/): MySQL, MariaDB, PostgreSQL, and SQL Server.

It ships two `DatabaseManager` implementations, mirroring how Ltijs itself ships both a fresh MongoDB backend and a legacy-compatible one:

| Class                            | Use it when...                                                                                        | Encryption                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `SequelizeDatabaseManager`       | You're starting a new Ltijs v7 deployment and don't need to carry over existing data.                 | None (matches Ltijs v7's own defaults).                                                   |
| `SequelizeLegacyDatabaseManager` | You're upgrading an existing `ltijs-sequelize@^2` (Ltijs v5/v6) deployment and want to keep its data. | Via `encryptionKey` — required in practice, since Ltijs v5/v6 always encrypted this data. |

#### Tested with:

| Database   | Tested              |
| ---------- | ------------------- |
| MySQL      | <center>✔️</center> |
| PostgreSQL | <center>✔️</center> |
| SQLite     | <center>✔️</center> |
| MariaDB    | <center></center>   |
| SQL Server | <center></center>   |

#### Ltijs Compatibility:

| Ltijs-sequelize version | Ltijs version |
| ----------------------- | ------------- |
| ^3.0.0                  | ^7.0.0        |
| ^2.4.2                  | ^5.7.0        |
| ^2.3.0                  | ^5.5.0        |
| ^2.2.0                  | ^5.3.0        |

---

## Installation

```shell
$ npm install ltijs-sequelize ltijs
```

Also install whichever Sequelize dialect driver your database needs (`mysql2`, `mariadb`, `pg` + `pg-hstore`, or `tedious`) — they're peer dependencies, not bundled, so only the one you actually use gets installed.

---

## Usage

Ltijs v7's default `database` option only ever builds the built-in `MongoDatabaseManager` — pass a fully-constructed `databaseManager` instead and `database` is ignored entirely, the same way you'd swap in any other [backend](https://cvmcosta.me/ltijs/#/guides/swapping-backends).

### Fresh installs — `SequelizeDatabaseManager`

```ts
import { Provider, DefaultLogger, IdTokenValidationMethod } from 'ltijs'
import { SequelizeDatabaseManager } from 'ltijs-sequelize'

const provider = new Provider({
  databaseManager: new SequelizeDatabaseManager(new DefaultLogger(), {
    database: 'database',
    username: 'user',
    password: 'password',
    options: { host: 'localhost', dialect: 'mysql', logging: false },
  }),
})

provider.onResourceLink(async (context, request, response) => {
  response.html(`Hello, ${context.idToken.user.name ?? 'learner'}!`)
})

await provider.listen()

await provider.platformManager.registerPlatform({
  url: 'https://platform.example.com',
  clientId: 'your-client-id',
  name: 'Example LMS',
  authenticationEndpoint: 'https://platform.example.com/auth',
  accessTokenEndpoint: 'https://platform.example.com/token',
  idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: 'https://platform.example.com/jwks' },
})
```

`config` accepts either `{ database, username, password, options }` (the same shape `new Sequelize(...)` itself takes — `options.dialect` is required) or a pre-built `{ sequelize: mySequelizeInstance }`. Both `SequelizeDatabaseManager` and `SequelizeLegacyDatabaseManager` expose the underlying connection as `databaseManager.sequelize`, if you need direct access.

### Upgrading from v2 — `SequelizeLegacyDatabaseManager`

Swap in `SequelizeLegacyDatabaseManager` instead — it reads and writes the same tables `ltijs-sequelize@^2` created (`idtoken`, `contexttoken`, `platform`, `platformStatus`, `publickey`, `privatekey`, `accesstoken`, `nonce`), running the same migrations it always has to bring an existing database up to date:

```ts
import { Provider, DefaultLogger } from 'ltijs'
import { SequelizeLegacyDatabaseManager } from 'ltijs-sequelize'

const provider = new Provider({
  databaseManager: new SequelizeLegacyDatabaseManager(
    new DefaultLogger(),
    { database: 'database', username: 'user', password: 'password', options: { host: 'localhost', dialect: 'mysql' } },
    process.env.LTIKEY, // the same value your v2 deployment passed to Provider.setup('LTIKEY', ...)
  ),
})
```

**Almost certainly pass `encryptionKey`.** Ltijs v5/v6's `Provider.setup(key, ...)` refused to start without that first `key` argument, and the same value was always reused internally as the encryption key for `publickey`/`privatekey`/`accesstoken` rows — so every real v2 deployment has that data encrypted, whether or not that was ever a conscious choice. Pass the same value here (it's only ever used to decrypt/encrypt those three tables now, nothing else). The parameter is technically optional only for a deployment that constructed a `Database` instance directly and never provided an encryption key to it.

Existing `platform`, `publickey`/`privatekey`, and `accesstoken` rows read and write normally with the right key — nothing needs to be migrated by hand. `idtoken`/`contexttoken` rows don't carry over: v5 correlated them by platform/user claims and a signed `ltik` cookie, with no single stored id, while Ltijs v7's interface requires one opaque `id` per launch. That's fine in practice — these are 24h-TTL launch-session rows, not configuration, and a v5-issued `ltik` isn't valid against a v7 deployment anyway, so there's never a real reason to read one from before the upgrade. New launches after upgrading write and read back correctly from the start.

> **Note:** Ltijs v7 no longer persists OIDC login `state` through the database at all (it's a signed, stateless token now), so the old `state` table is unused by both managers going forward.

---

## Contributing

Please ⭐️ us on [GitHub](https://github.com/Cvmcosta/ltijs), it always helps!

If you find a bug or think that something is hard to understand feel free to open an issue or contact me on twitter [@cvmcosta](https://twitter.com/cvmcosta), pull requests are also welcome :)

And if you feel like it, you can donate any amount through paypal, it helps a lot.

<a href="https://www.buymeacoffee.com/UL5fBsi" target="_blank"><img width="217" src="https://cdn.buymeacoffee.com/buttons/lato-green.png" alt="Buy Me A Coffee"></a>

### Main contributors

<table>
  <tr>
    <td align="center"><a href="https://github.com/Cvmcosta"><img src="https://avatars2.githubusercontent.com/u/13905368?s=460&v=4" width="100px;" alt="Carlos Costa"/><br /><sub><b>Carlos Costa</b></sub></a><br /><a href="#" title="Code">💻</a><a href="#" title="Answering Questions">💬</a> <a href="#" title="Documentation">📖</a> <a href="#" title="Reviewed Pull Requests">👀</a> <a href="#" title="Talks">📢</a></td>
    <td align="center"><a href="https://github.com/lucastercas"><img src="https://avatars1.githubusercontent.com/u/45924589?s=460&v=4" width="100px;" alt="Lucas Terças"/><br /><sub><b>Lucas Terças</b></sub></a><br /><a href="#" title="Documentation">📖</a> <a href="https://github.com/lucastercas/ltijs-firestore" title="Tools">🔧</a></td>
    <td align="center"><a href="https://github.com/micaelgoms"><img src="https://avatars0.githubusercontent.com/u/23768058?s=460&v=4" width="100px;" alt="Micael Gomes"/><br /><sub><b>Micael Gomes</b></sub></a><br /><a href="#" title="Design">🎨</a></td>

  </tr>

</table>

---

## Special thanks

<div align="center">
  <a href="https://portais.ufma.br/PortalUfma/" target="_blank"><img width="150" src="https://raw.githubusercontent.com/Cvmcosta/ltijs/master/website/assets/ufma-logo.png"></img></a>
  <a href="https://www.unasus.ufma.br/" target="_blank"><img width="350" src="https://raw.githubusercontent.com/Cvmcosta/ltijs/master/website/assets/unasus-logo.png"></img></a>
</div>

> I would like to thank the Federal University of Maranhão and UNA-SUS/UFMA for the support throughout the entire development process.

<div align="center">
  <a href="https://coursekey.com/" target="_blank"><img width="180" src="https://raw.githubusercontent.com/Cvmcosta/ltijs/master/website/assets/coursekey-logo.png"></img></a>
</div>

> I would like to thank CourseKey for making the Certification process possible and allowing me to be an IMS Member through them, which will contribute immensely to the future of the project.

---

## License

[![APACHE2 License](https://img.shields.io/github/license/cvmcosta/ltijs-sequelize)](LICENSE)
