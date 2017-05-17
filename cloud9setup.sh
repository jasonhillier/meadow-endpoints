#! /bin/bash
echo "Setup a Cloud9 environment for Meadow Endpoints"
echo "MIT License."
echo "steven velozo <steven@velozo.com>"
echo ""
echo "---"
echo ""
echo "## MySQL Parameters exist.  Script running!"
echo "##"
echo ""
echo "!! This may be bad to run on anything but a Cloud9 virtual machine !!"
echo ""
read -p "Press [Enter] key to configure the environment..."
echo ""
echo "## Initializing the Cloud9 database environment..."
time mysql-ctl start
echo ""
echo "## Creating Fable and Meadow databases and users..."
time mysql-ctl cli < test/scripts/InitializeDatabase-C9.sql
echo ""
echo "## Remember to Switch to node 5.x by running these commands..."
echo "nvm use 6"
echo "nvm alias default 6"
echo ""
echo "## And we're done!  Have a great day."
