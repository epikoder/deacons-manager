export default class MResponse {
  private _status: Api["status"];
  private _data: Api["data"];
  private _meta: Api["$meta"];

  constructor(status: Api["status"]) {
    this._status = status;
  }

  static success() {
    return new MResponse("success");
  }

  static failed() {
    return new MResponse("failed");
  }

  get isSuccess() {
    return this._status == "success";
  }

  appendMeta(meta: Api["$meta"]) {
    this._meta = { ...this._meta, ...meta };
    return this;
  }

  meta(meta: Api["$meta"]) {
    this._meta = meta;
    return this;
  }

  data(data: Api["data"]) {
    this._data = data;
    return this;
  }

  build() {
    return JSON.stringify(<Api>{
      status: this._status,
      data: this._data,
      $meta: this._meta,
    });
  }
}
