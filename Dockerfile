# to be triggered via floe

FROM ubuntu

EXPOSE 8080 8081

ENV HOME /root
ENV DEBIAN_FRONTEND noninteractive
ENV LC_ALL C.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8
ENV TZ America/Chicago
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN \
  apt-get update \
  && apt-get -y upgrade \
  && apt-get -y install \
  xvfb \
  x11vnc \
  supervisor \
  chromium-browser \
  openbox \
  wget \
  ca-certificates \
  python \
  net-tools \
  && apt-get clean \
  && rm /etc/xdg/openbox/rc.xml \
  && echo "<openbox_config><applications><application class=\"*\"><maximized>yes</maximized><decor>no</decor></application></applications></openbox_config>" >> /etc/xdg/openbox/rc.xml

RUN \
  mkdir -p /opt/noVNC/utils/websockify \
  && wget -qO- "http://github.com/kanaka/noVNC/tarball/master" \
    | tar -zx --strip-components=1 -C /opt/noVNC \
  && wget -qO- "https://github.com/kanaka/websockify/tarball/master" \
    | tar -zx --strip-components=1 -C /opt/noVNC/utils/websockify \
  && echo "<style>#top_bar {display:none!important}</style><script>console.log(\"loaded\"); function mousemovenotifyparent(x,y) { window.parent.postMessage(JSON.stringify({type:\"mousemove\",data:{x,y}}), \"*\") }; function initmousepass() {window.parent.postMessage(JSON.stringify({type:\"init\"}), \"*\"); document.getElementsByTagName(\"canvas\")[0].addEventListener(\"mousemove\", (e) => { mousemovenotifyparent(e.clientX, e.clientY) })} function searchforcanvas() { if (!document.getElementsByTagName(\"canvas\")[0]) { window.requestAnimationFrame(searchforcanvas) } else { initmousepass() } }; searchforcanvas(); window.addEventListener('message', function(e) {window.parent.postMessage(JSON.stringify({type:\"pong\"}), \"*\")},false) </script>" >> /opt/noVNC/vnc_lite.html \
  && sed -i "s/url += '\/' + path;/url += document.location.pathname + path;/g" /opt/noVNC/vnc_lite.html \
  && sed -i "s/function disconnectedFromServer(e) {/function disconnectedFromServer(e) { window.parent.postMessage(JSON.stringify({type:\"disconnected\"}), \"*\");/g" /opt/noVNC/vnc_lite.html \
  && sed -i "s/dimgrey/white/g" /opt/noVNC/vnc_lite.html \
  && sed -i "s/40, 40, 40/255, 255, 255/g" /opt/noVNC/core/rfb.js \
  && ln -s /opt/noVNC/vnc_lite.html /opt/noVNC/index.html \
  && mkdir -p /tmp/estuary \
  && mkdir -p /tmp/ublock \
  && wget "http://jollo.org/archive/doir/estuary.tar" \
  && wget "http://jollo.org/archive/doir/ublock.tar" \
  && tar -xf estuary.tar -C /tmp/estuary \
  && tar -xf ublock.tar -C /tmp/ublock

RUN adduser --disabled-password --gecos "" headless

COPY novnc.conf /etc/supervisor/conf.d/novnc.conf
CMD ["/usr/bin/supervisord"]
