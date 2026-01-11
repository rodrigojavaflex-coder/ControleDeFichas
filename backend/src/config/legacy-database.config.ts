import { registerAs } from '@nestjs/config';

export default registerAs('legacyDatabases', () => ({
  // Banco 1: INHUMAS (unidade 2) + NERÓPOLIS (unidade 4)
  banco1: {
    host: process.env.LEGACY_DB1_HOST || 'localhost',
    port: parseInt(process.env.LEGACY_DB1_PORT || '3050', 10),
    database: process.env.LEGACY_DB1_PATH || 'C:\\PROJETOS\\AVALIACAO_BANCO_FIREBIRD\\bancofc.ib',
    user: process.env.LEGACY_DB1_USER || 'SYSDBA',
    password: process.env.LEGACY_DB1_PASSWORD || 'masterkey',
    role: process.env.LEGACY_DB1_ROLE || undefined,
    pageSize: 4096,
    charset: process.env.LEGACY_DB1_CHARSET || 'NONE', // Charset do banco é NONE
  },
  // Banco 2: UBERABA (unidade 2)
  banco2: {
    host: process.env.LEGACY_DB2_HOST || 'localhost',
    port: parseInt(process.env.LEGACY_DB2_PORT || '3050', 10),
    database: process.env.LEGACY_DB2_PATH || 'C:\\PROJETOS\\AVALIACAO_BANCO_FIREBIRD\\bancofcube.ib',
    user: process.env.LEGACY_DB2_USER || 'SYSDBA',
    password: process.env.LEGACY_DB2_PASSWORD || 'masterkey',
    role: process.env.LEGACY_DB2_ROLE || undefined,
    pageSize: 4096,
    charset: process.env.LEGACY_DB2_CHARSET || 'NONE', // Charset do banco é NONE
  },
}));

