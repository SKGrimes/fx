# Artifex Lawsite Build


# Quickstart
Just download everything as global as most of the task runners & services need to be global anyway. NPM should default to local in most cases anyway.

```
npm install -g eslint-plugin gulp nodemon mocha chain bower pm2
cd fx && npm install && bower install
npm start
```

The assets are served using express and the application is compiled into the app folder. Barring
any express configurations, the entire project was built inside the src folder. bower is configured to output all of the components there which are referenced in the config.json file in root. The gulp tasks build & compile the foundation classes and then monitor the vendor and user scripts & scss and copy them.

All static assets that are not dynamic are moved into the app/public folder as well. I ended up having to use imagemin because some of the files were properly massive when I pulled them out of ps
for some reason.

dragend is included in components but is not neccessary for the build.

Also, I will update this with a more precise set of directions as node 6.x is used and the
airbnb styleguid calls for using es6 features....e.g. it won't build/run withoiut them. Some of that is actually foundation-cli/foundation-sites. but I will update it as soon as I get a second.




# Overview

## Client

The entry point for the app is at `bin/www` in is a node shell script that uses express as a simple server.



## SRC

The bulk of the application is constructed within `src` with the exception of the `views` files which are some markup and handlebars files that end up being compiled and served.

## App

> Express gateway API



### Basic Structure

```
├── app/
│   ├── public/  	// exentially a dist folder, all static assets from src
│   ├── images/
│   ├── js/
│	├── stylesheets/
│   └── app.js		// core configurations of the express app & middleware
├── src
│   ├── components
│   │   ├── foundation-sites/
│   │   └── other vendor libs, ect/
│   ├── images
│   ├── js
│   │   ├── app.js	// concat all vendor scripts
│   │   └── main.js
│   └── scss/
├── config.json		// json configuration file for simplifying gulp task reqs.
├── eslintrc.json	// core style && linting using airbnb styyleguide
├── package.json

```





# Setting Up The Basic Development environment



To test out basic functionality and get at least a somewhat similar sense for how this could look in production there are some reasonably easy steps to mirror the deployment configuration. This assumes running OS X on a Mac and deploying into a linux environment. On linux, setup would be similar and even closer to what would be replicated in production. Configuration setup:

1. DNS Resolution with DNSMasq
2. Nginx reverse proxy configuration
3. SSL cert setup

## DNSMasq

[Dnsmasq](http://www.thekelleys.org.uk/dnsmasq/doc.html) does a lot of things, from the docs, "provides network infrastructure for small networks: DNS, DHCP, router advertisement and network boot". You can use it to configure a subdomain and internal DNS resolution. Setting up DNS on the local environment just makes it a bit easier to work with the technology stack as it would exist in production. That is the reason it is employed here. This would typically just be done on the hosting provider or some DNS hosting service panel. To get started use homebrew and download dnsmasq.

```
brew update && brew install dnsmasq

cp $(brew list dnsmasq | grep /dnsmasq.conf.example$) /usr/local/etc/dnsmasq.conf

sudo cp $(brew list dnsmasq | grep /homebrew.mxcl.dnsmasq.plist$) /Library/LaunchDaemons/

sudo launchctl load /Library/LaunchDaemons/homebrew.mxcl.dnsmasq.plist
```

This will install dnsmasq, copy the `dnsmasq.config` file to the local `/ect` directory and start the service now, and subsequently at system startup automatically, so it won't have to be done manually. On OS X el Capitan there seems to be permissions issues with the new SIP security.

**Note** Setting up the configs properly basically requires `sudo` everywhere on el capitan and making sure the files have correct permissions as some are symlinked or otherwise just not read and fail silently causing this not to work. Also, the default homebrew directory is assumed to be `/usr/local`.


Add the following to the file `/usr/local/etc/dnsmasq.conf`.

```

address=/.self/127.0.0.1
address=/.world/127.0.0.1
address=/.dev/127.0.0.1
```

Whatever extensions you add here e.g. the `/.self` extension above, need corresponding files in the `/ect/resolver` directory which you will need to make if it doesn't exist.

```
# make a resolver dir
sudo mkdir /ect/resolver

# make a file for all extensions you added above
sudo touch /ect/resolver/self /ect/resolver/dev /ect/resolver/world


sudo nano /etc/resolver/self
# add localhost ip to all files, e.g. from nano:
nameserver 127.0.0.1

# repeat for each domain
```

The above files are basically representative of a toplevel domain on the internet. Dnsmasq acts as a dns server to some extent (although not the same exact way) and resolves domains locally. After that is complete, confirm dnsmasq is running.

```
 ps ax | grep dnsmasq

 2160   ??  Ss     0:00.01 /usr/local/opt/dnsmasq/sbin/dnsmasq --keep-in-foreground -C /usr/local/etc/dnsmasq.conf
 2187 s001  S+     0:00.00 grep --color=auto dnsmasq

```

...and that the resolution is happening properly.

```
ping hello.self

PING hello.self (127.0.0.1): 56 data bytes
64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.038 ms
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.059 ms
^C
--- hello.self ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.038/0.049/0.059/0.010 ms

klevvver@221b /etc
❯

```


Add the service alias to `~/.bash_profile` or `~/.alias`  if you'd like

then stop dnsmasq `sudo launchctl stop homebrew.mxcl.dnsmasq` and start it again `sudo launchctl start homebrew.mxcl.dnsmasq`

```
# start dnsmasq
alias strdnsmasq="sudo launchctl stop homebrew.mxcl.dnsmasq"

# stop
alias stpdnsmasq="sudo launchctl start homebrew.mxcl.dnsmasq"

# restart dnsmasq
alias rsdnsmasq="sudo launchctl stop homebrew.mxcl.dnsmasq && sudo launchctl start homebrew.mxcl.dnsmasq"
```

## Nginx

![nginx](https://assets.wp.nginx.com/wp-content/uploads/2015/04/NGINX_logo_rgb-01.png)


We install nginx on the server to serve as a reverse proxy and also configure it to not only sit in front of pm2 in deployment but also to terminate our ssl.

**note** The http2 module isn't nec. but a realistic addition, you can uninstall and reinstall nginx to be built with HTTP2 support by throwing the flag `--with-http2`. Additionally `--with-libressl` but openssl is fine.

```
❯ apt-get install  nginx --with-http2
==> Downloading http://nginx.org/download/nginx-1.10.0.tar.gz
######################################################################## 100.0%
==> ./configure --prefix=/usr/local/Cellar/nginx/1.10.0 --with-http_ssl_module --with-pcre --with-ipv6 --sbin-pa
==> make install
==> Caveats
Docroot is: /usr/local/var/www

The default port has been set in /usr/local/etc/nginx/nginx.conf to 8080 so that
nginx can run without sudo.

nginx will load all files in /usr/local/etc/nginx/servers/.

To have launchd start nginx now and restart at login:
  brew services start nginx
Or, if you don't want/need a background service you can just run:
  nginx
```


```
sudo cp /usr/local/opt/nginx/*.plist /Library/LaunchDaemons
sudo launchctl load -w /Library/LaunchDaemons/homebrew.mxcl.nginx.plist

nano /usr/local/etc/nginx/nginx.conf
```

If that file doesn't exist there should be a default.conf file in that toplevel dir. After that make sure nginx is running.

```
ps ax grep | grep nginx
sudo nginx
```

**Main Static Root Directory**

If installed with homebrew the file should be inside the cellar inside nginx directory. version numbers differ and there is no SSL support by default so http:localhost:3000 will succeed but `https://` will *not*.


```
/ect/nginx/html
```

The above directory path is what nginx will resolve to by default. However, the setup  uses proxy pass for local development.

![Nginx default](https://dab1nmslvvntp.cloudfront.net/wp-content/uploads/2013/09/nginx-fcgi-2.png)

### Config file /usr/local/ect/nginx/nginx.conf
```

worker_processes  1;

events {
    worker_connections  1024;
}


http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;

    server {
        listen 80;

        server_name localhost;

        location / {
            proxy_pass 127.0.0.1:9000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }


    include servers/*;
}
```

After restarting nginx,

```
$ sudo service nginx reload && sudo service nginx
```

If proxypass wasn't enabled yet, you can see the default message. Or it is possible you already saw it in a previous step. However, with proxypass we will generate a hello message from nginx which should show up on port 80, e.g. `http:localhost/` or `127.0.0.1`, or even the above domains setup with dnsmasq like `http://love.your.self`. ect.


### confirm it works with node

If you copy this and run it, then go to somedomain.self (or whatever extension) it should resolve to helloworld.


**server.js**
```
var port = 9000;
var host = 'localhost';

var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(port, host);
console.log('Server running at http://',host, port);
```

Run `node server.js` and restart nginx `sudo nginx -s stop && sudo nginx`, if done properly these should work:

* nginx should pass any of the resolver domains from dnsmasq to `port:3333`, which shows `hello world`.
* http://something.self, http:hello.dev, http://127.0.0.1, localhost, ect should all resolve to the simple node server (or whatever is runnning on the port configured in the nginx.conf)

## Let's Encrypt

I used openssl to gen wildcard certs but you can get some for frree using let's encrypt.



### Full Nginx Config file

```
/usr/local/etc/nginx/nginx.conf
```
contents:
```
###################################
#        NGINX CONFIG FILE        #
###################################

# Process Info
###############

#user  nobody;
#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;
#pid        logs/nginx.pid;



worker_processes  1;

events {
    worker_connections  1024;
}


http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;

    server {
        listen 80;

        server_name localhost;

        location / {
            proxy_pass http://localhost:3333;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

    include servers/*;
}



```

### Nginx /servers/default config file

Inside of `/servers` referenced on last line, which is relative to the path of the `nginx.conf` make a file called `dangerous` or in reality whatever the host name is supposed to be, if in production, and use it to identify the additional ssl config.

The above proxy from to `http://127.0.0.1:3000` to localhost on 3333, e.g. `http://127.0.0.1:3333`




see basic config file below in appendix.


Inside file example. **unicorn.dev**

```
 server {

        listen   443;
        server_name tinybig.co;


        location / {
            proxy_pass http://localhost:3333;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        ssl on;
        # not the real cert path; it is outputted from ./opt/letsencrypt
        # this is a variation of my local dev env.
        ssl_certificate /usr/local/etc/ssl/dangerzone.chained.crt;
        ssl_certificate_key /usr/local/etc/ssl/dangerzone.key;
}
```

This is the local cert setup for testing ssl/https

![chrome](https://i.imgur.com/jrgx8vW.png)





## Setup & Configure PM2

This is a sample from [keymetrics](http://pm2.keymetrics.io/docs/usage/application-declaration/) the company behind PM2, from the [github pm2 repo](https://github.com/Unitech/pm2):

> PM2 is a production process manager for Node.js applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

```json
{
  "apps" : [{
    "script"      : "worker.js",
    "watch"       : true,
    "env": {
      "NODE_ENV": "development",
    },
    "env_production" : {
       "NODE_ENV": "production"
    }
  },{
    "name"       : "api-app",
    "script"     : "api.js",
    "instances"  : 4,
    "exec_mode"  : "cluster"
  }]
}
```



A `.json` file like above is a good way to manage a production deployment. To create a similar local environment install pm2 and pm2-dev from npm.

```shell
npm install -g pm2 && pm2-dev
```



To run processes for our app, we will run in cluster mode as we have serices. This and files like this are placed in root directory.

```
{
  "apps" : [{
    "script"      : "services.js",
    "watch"       : true,
    "env": {
      "NODE_ENV": "development",
      "PORT"    : 8888
    },
    "env_production" : {
       "NODE_ENV": "production"
    }
  },{
    "name"       : "api-app",
    "script"     : "server.js",
    "instances"  : 2,
    "exec_mode"  : "cluster",
    "max_restarts"			: 2,

  }]
}
```

*example of current `./process.json` file in placed in projects root*

Thein in `package.json` use the pm2-dev program to start the application by placing a similar line into the start script, in the truncated example below.

```json
{
  "name": "api-bridge",
  "version": "0.0.1",
  "description": "API Gateway Bridge",
  "main": "index.js",
  "scripts": {
    "test": "./node_modules/mocha/bin/mocha ./test/*.js",
    "start": "pm2-dev start process.json api-app"
  },
  "dependencies": {
    "socket.io": "^1.4.6"
  },
  "devDependencies": {
    "chai": "^3.5.0"
  }
}

```



This will start app.




