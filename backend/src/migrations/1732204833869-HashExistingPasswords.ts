import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class HashExistingPasswords1732204833869 implements MigrationInterface {
    name = 'HashExistingPasswords1732204833869';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Buscar todos os usuários com senhas em texto plano
        // Assumimos que senhas com menos de 20 caracteres provavelmente não são hashes bcrypt
        const users = await queryRunner.query(`
            SELECT id, password FROM users 
            WHERE LENGTH(password) < 20 OR password NOT LIKE '$2%'
        `);

        // Hash das senhas existentes
        for (const user of users) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            
            await queryRunner.query(`
                UPDATE users 
                SET password = $1 
                WHERE id = $2
            `, [hashedPassword, user.id]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Não podemos reverter hashes para texto plano por razões de segurança
        // Esta migração é irreversível
        throw new Error('Cannot revert password hashing migration for security reasons');
    }
}