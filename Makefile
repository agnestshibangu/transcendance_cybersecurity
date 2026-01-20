# Docker Compose file name
COMPOSE_FILE = docker-compose.yml

# Start containers
up:
	docker compose -f $(COMPOSE_FILE) up -d

# Build images only
build:
	docker compose -f $(COMPOSE_FILE) build

# Rebuild images and restart containers
rebuild:
	docker compose -f $(COMPOSE_FILE) up -d --build

# Show all logs
logs:
	docker compose -f $(COMPOSE_FILE) logs -f

# Show logs of a specific container
logs-one:
	docker logs -f $(name)

# Stop containers without removing them
stop:
	docker compose -f $(COMPOSE_FILE) stop

# Stop and remove containers
down:
	docker compose -f $(COMPOSE_FILE) down

# Remove images built by docker compose
rmi:
	docker compose -f $(COMPOSE_FILE) down --rmi all

# Remove volumes used by docker compose
rmvol:
	docker compose -f $(COMPOSE_FILE) down -v

# Remove containers, images and volumes
clean:
	docker compose -f $(COMPOSE_FILE) down --rmi all -v

# Remove all Docker images
prune-images:
	docker image prune -a -f

# Remove all Docker volumes
prune-volumes:
	docker volume prune -f

# Remove everything
prune-all:
	docker system prune -a --volumes -f

# Show running containers status
ps:
	docker compose -f $(COMPOSE_FILE) ps

# Restart all containers
restart:
	docker compose -f $(COMPOSE_FILE) restart

# Open an interactive shell inside a container
# Usage: make exec name=<container_name>
exec:
	docker exec -it $(name) /bin/sh

# Full reset: clean everything, rebuild and start
reset: clean build up

help:
	@echo "********* Available Make commands *********"
	@echo "make up             → Start containers"
	@echo "make build          → Build images only"
	@echo "make rebuild        → Rebuild images and start containers"
	@echo "make stop           → Stop containers without removing"
	@echo "make down           → Stop and remove containers"
	@echo "make rmi            → Remove images"
	@echo "make rmvol          → Remove volumes"
	@echo "make clean          → Remove containers, images, and volumes"
	@echo "make prune-images   → Remove all Docker images"
	@echo "make prune-volumes  → Remove all Docker volumes"
	@echo "make prune-all      → Remove all images, volumes, and cache"
	@echo "make ps             → Show running containers"
	@echo "make logs           → Show all container logs"
	@echo "make logs-one name=<container> → Show logs for one container"
	@echo "make restart        → Restart all containers"
	@echo "make exec name=<container> → Open a shell in a container"
	@echo "make reset          → Clean, rebuild, and start all services"

.PHONY: up build rebuild stop down rmi rmvol clean ps restart logs logs-one exec reset help prune-images prune-volumes prune-all
