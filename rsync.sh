for i in $(seq 1 100000); do rsync -avz --no-perms --no-owner --no-group * root@maics-appliance-01:/var/www/maics/ --progress; sleep 1; done
