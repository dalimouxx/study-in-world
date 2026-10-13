// Doit être importé en premier : ConfigModule valide l'environnement dès l'import d'AppModule.
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
process.env.JWT_SECRET = 'x'.repeat(40);
process.env.NODE_ENV = 'test';
