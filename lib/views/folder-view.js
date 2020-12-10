'use babel';

import DirectoryView from './directory-view.js';
import ServerView from './server-view.js';

const md5 = require('md5');

class FolderView extends DirectoryView {

  FolderView() {
    super.FolderView();

    const self = this;

    self.id = null;
    self.parent = null;
    self.config = null;
    self.name = '';
    self.servers = [];
    self.isExpanded = false;
    self.debug = false;
    self.showRecentFilesCache = false;
  }

  static content() {
    return this.li({
      class: 'folder entry list-nested-item project-root collapsed',
    }, () => {
      this.div({
        class: 'header list-item project-root-header',
        outlet: 'header',
      }, () => this.span({
        class: 'name icon',
        outlet: 'label',
      }));
      this.ol({
        class: 'entries list-tree',
        outlet: 'entries',
      });
    });
  };

  serialize() {
    const self = this;

    return {
      id: self.id,
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };
  }

  initialize(config, treeView) {
    const self = this;

    self.treeView = treeView
    self.parent = null;
    self.config = config;
    self.name = self.config.name ? self.config.name : self.config.host;
    self.servers = self.config.servers;
    self.isExpanded = false;
    self.id = self.getId();

    if (atom.config.get('ftp-remote-edit-plus.dev.debug')) {
      self.debug = atom.config.get('ftp-remote-edit-plus.dev.debug');
    } else {
      self.debug = false;
    }


    self.label.text(self.name);
    self.label.addClass('icon-file-symlink-directory');
    self.addClass('project-root');

    self.attr('data-name', '/');
    self.attr('data-host', self.config.host);
    self.attr('id', self.id);

    self.on('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();
      self.toggle();
    });

    // Drag & Drop
    self.on('dragstart', (e) => self.onDragStart(e));
    self.on('dragenter', (e) => self.onDragEnter(e));
    self.on('dragleave', (e) => self.onDragLeave(e));
    self.on('drop', (e) => self.onDrop(e));
  };

  getId() {
    const self = this;

    let object = {
      config: self.config,
      name: self.name,
      path: self.getPath(false),
    };

    return 'ftp-remote-edit-' + md5(JSON.stringify(object));
  }

  toggle() {
    const self = this;

    if (self.isExpanded) {
      self.collapse();
    } else {
      self.expand()
        .catch(function (err) {
          self.getRoot();
        })
    }
  };

  expand() {
    const self = this;
    let promise = new Promise((resolve, reject) => {
      self.entries.children()
        .detach();
      self.isExpanded = true;
      self.setClasses();
      self.label.addClass('icon-sync')
        .addClass('spin')
        .removeClass('icon-file-directory');
      self.deselect();
      self.select(self);
      self.label.removeClass('icon-sync')
            .removeClass('spin')
            .addClass('icon-file-directory');
      self.paint(self.servers);
      resolve(true);
    });

    return promise;
  };

  paint(list) {
    const self = this;
    let entries = [];

    if (list) {
      self.list = list;
    } else {
      list = self.list;
    }
    self.entries.children()
      .detach();
    list.forEach(function (config) {
      let li = new ServerView(config, self.treeView);
      entries.push(li);
    }, this);
    entries.forEach(function (entry) {
      self.entries.append(entry);
    });
  };

  collapse() {
    const self = this;

    self.isExpanded = false;
    self.setClasses();
    self.entries.children()
      .detach();
    self.label.removeClass('icon-sync')
      .removeClass('spin')
      .addClass('icon-file-directory');
  };

  addRecentFileEntry(file) {
    const self = this;
    self.parent.addRecentFileEntry(file)
  }

  delRecentFileEntry(file) {
    const self = this;
    self.parent.delRecentFileEntry(file)
  }

  onDragStart(e) {
    const self = this;
    let entry, initialPath;

    if (entry = e.target.closest('.entry')) {
      e.stopPropagation();
      initialPath = self.getPath(true);

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("initialType", "server");
      } else if (e.originalEvent.dataTransfer) {
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("initialType", "server");
      }
    }
  };

  onDragEnter(e) {
    const self = this;
    let entry, header, initialType;

    if (header = e.target.closest('.entry.server > .header')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }
      if (initialType == "server") {
        return;
      }

      entry = header.parentNode;
      if (!entry.classList.contains('selected')) {
        entry.classList.add('selected');
      }
    }
  };

  onDragLeave(e) {
    const self = this;
    let entry, header, initialType;

    if (header = e.target.closest('.entry.server > .header')) {
      e.stopPropagation();

      if (e.dataTransfer) {
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialType == "server") {
        return;
      }

      entry = header.parentNode;
      if (entry.classList.contains('selected')) {
        entry.classList.remove('selected');
      }
    }
  };

  onDrop(e) {
    const self = this;
    let entry, file, i, initialPath, len, newDirectoryPath, ref;

    if (entry = e.target.closest('.entry')) {
      e.preventDefault();
      e.stopPropagation();

      entry.classList.remove('selected');
      if (!entry.classList.contains('server')) {
        return;
      }

      newDirectoryPath = self.getPath(false);
      if (!newDirectoryPath) {
        return false;
      }

      if (e.dataTransfer) {
        initialPath = e.dataTransfer.getData("initialPath");
        initialName = e.dataTransfer.getData("initialName");
        initialType = e.dataTransfer.getData("initialType");
      } else {
        initialPath = e.originalEvent.dataTransfer.getData("initialPath");
        initialName = e.originalEvent.dataTransfer.getData("initialName");
        initialType = e.originalEvent.dataTransfer.getData("initialType");
      }

      if (initialPath.trim() == newDirectoryPath.trim()) return;

      if (initialPath) {
        if (initialType == "directory") {
          newDirectoryPath += initialName + '/';
          self.moveDirectory(initialPath, newDirectoryPath);
        } else if (initialType == "file") {
          newDirectoryPath += initialName;
          self.moveFile(initialPath, newDirectoryPath);
        }
      } else {
        // Drop event from OS
        if (e.dataTransfer) {
          ref = e.dataTransfer.files;
        } else {
          ref = e.originalEvent.dataTransfer.files;
        }

        for (i = 0, len = ref.length; i < len; i++) {
          file = ref[i];
          self.upload(file.path, newDirectoryPath);
        }
      }
    }
  };
}

module.exports = FolderView;
