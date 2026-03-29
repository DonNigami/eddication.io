#!/bin/bash

# PTG eZView Integration Client - Quick Setup Script
# รันสคริปต์นี้เพื่อติดตั้งและเริ่มใช้งาน

set -e

echo "================================"
echo "PTG eZView Setup Wizard"
echo "================================"
echo ""

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker found"
    USE_DOCKER=true
else
    echo "⚠️  Docker not found, will use native installation"
    USE_DOCKER=false
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "✅ Python found: $PYTHON_VERSION"
    USE_PYTHON=true
else
    echo "❌ Python 3 not found"
    USE_PYTHON=false
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js found: $NODE_VERSION"
    USE_NODEJS=true
else
    echo "⚠️  Node.js not found"
    USE_NODEJS=false
fi

echo ""
echo "================================"
echo "Configuration"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Prompt for credentials
    read -p "Enter PTG Username [LPG_Bulk]: " USERNAME
    USERNAME=${USERNAME:-LPG_Bulk}
    read -sp "Enter PTG Password: " PASSWORD
    echo ""

    # Update .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/PTG_USERNAME=.*/PTG_USERNAME=$USERNAME/" .env
        sed -i '' "s/PTG_PASSWORD=.*/PTG_PASSWORD=$PASSWORD/" .env
    else
        sed -i "s/PTG_USERNAME=.*/PTG_USERNAME=$USERNAME/" .env
        sed -i "s/PTG_PASSWORD=.*/PTG_PASSWORD=$PASSWORD/" .env
    fi

    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "================================"
echo "Installation"
echo "================================"

# Ask for installation method
echo ""
echo "Choose installation method:"
echo "  1) Docker (Recommended)"
if [ "$USE_PYTHON" = true ]; then
    echo "  2) Python"
fi
if [ "$USE_NODEJS" = true ]; then
    echo "  3) Node.js"
fi

read -p "Enter choice [1]: " CHOICE
CHOICE=${CHOICE:-1}

case $CHOICE in
    1)
        echo ""
        echo "Installing with Docker..."
        echo ""

        # Choose version
        read -p "Choose version (python/nodejs) [python]: " VERSION
        VERSION=${VERSION:-python}

        echo "Building Docker image ($VERSION)..."
        docker-compose --profile $VERSION build

        echo "Starting container..."
        docker-compose --profile $VERSION up -d

        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Commands:"
        echo "  View logs: docker-compose logs -f"
        echo "  Stop: docker-compose down"
        echo "  Restart: docker-compose restart"
        ;;

    2)
        if [ "$USE_PYTHON" = false ]; then
            echo "❌ Python not found. Please install Python 3 first."
            exit 1
        fi

        echo ""
        echo "Installing Python dependencies..."
        pip3 install -r requirements.txt

        echo ""
        echo "Testing connection..."
        python3 ptg_ezview_client.py --once

        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Commands:"
        echo "  Run once: python3 ptg_ezview_client.py --once"
        echo "  Run daemon: python3 ptg_ezview_client.py --daemon"
        ;;

    3)
        if [ "$USE_NODEJS" = false ]; then
            echo "❌ Node.js not found. Please install Node.js first."
            exit 1
        fi

        echo ""
        echo "Installing Node.js dependencies..."
        npm install

        echo ""
        echo "Testing connection..."
        npm run once

        echo ""
        echo "✅ Installation complete!"
        echo ""
        echo "Commands:"
        echo "  Run once: npm run once"
        echo "  Run daemon: npm start"
        ;;

    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Check logs to verify data is being fetched"
echo "  2. Configure schedule interval in .env (PTG_SCHEDULE_MINUTES)"
echo "  3. Set up monitoring (optional)"
echo ""
echo "For more information, see README.md"
echo ""
