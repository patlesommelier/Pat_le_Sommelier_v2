-- Modèle de Claude utilisé pour chaque plat : passe rapide (Sonnet) à l'inscription, Opus ensuite.
-- null = modèle par défaut du serveur (ANTHROPIC_MODEL, sinon Opus).
alter table generation_accords add column if not exists modele text;
