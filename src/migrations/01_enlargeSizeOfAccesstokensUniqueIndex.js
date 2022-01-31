'use strict'

const up = async ({ context: queryInterface }) => {
  try {
    await queryInterface.removeIndex(
      'accesstokens',
      'accesstokens_platform_url_client_id_scopes'
    )

    await queryInterface.addIndex(
      'accesstokens',
      [
        { name: 'platformUrl', length: 255 },
        { name: 'clientId', length: 255 },
        { name: 'scopes', length: 255 }
      ],
      {
        name: 'accesstokens_platform_url_client_id_scopes',
        unique: true
      }
    )
  } catch (err) {
    console.error('Database migration failed', err)
  }
}

const down = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex(
    'accesstokens',
    'accesstokens_platform_url_client_id_scopes'
  )

  await queryInterface.addIndex(
    'accesstokens',
    [
      { name: 'platformUrl', length: 50 },
      { name: 'clientId', length: 50 },
      { name: 'scopes', length: 50 }
    ],
    {
      name: 'accesstokens_platform_url_client_id_scopes',
      unique: true
    }
  )
}

module.exports = { up, down }
