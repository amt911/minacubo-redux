COMPOSE_DEV = docker compose -f docker-compose.yml
COMPOSE_PROD = docker compose -f docker-compose.prod.yml

all: help

help:
	@echo "MinaCubo Redux — make targets"
	@echo ""
	@echo "  up           Start dev container (foreground, logs visible)"
	@echo "  up-d         Start dev container (detached)"
	@echo "  down         Stop dev container"
	@echo "  restart      Stop + reset node_modules volume + start"
	@echo "  reinstall    Reset node_modules volume (no container restart)"
	@echo "  logs         Tail dev container logs"
	@echo "  shell        Shell into dev container"
	@echo "  prod         Start prod container (nginx)"
	@echo "  prod-down    Stop prod container"
	@echo "  clean        Stop + remove all volumes + remove images"
	@echo ""

up:
	$(COMPOSE_DEV) up --build

up-d:
	$(COMPOSE_DEV) up -d --build

down:
	$(COMPOSE_DEV) down

restart:
	$(COMPOSE_DEV) down
	bash scripts/reset-node-modules.sh
	$(COMPOSE_DEV) up --build

reinstall:
	bash scripts/reset-node-modules.sh

logs:
	$(COMPOSE_DEV) logs -f

shell:
	$(COMPOSE_DEV) exec minacubo sh

prod:
	$(COMPOSE_PROD) up --build

prod-down:
	$(COMPOSE_PROD) down

clean:
	$(COMPOSE_DEV) down -v --rmi all --remove-orphans

.PHONY: help up up-d down restart reinstall logs shell prod prod-down clean
