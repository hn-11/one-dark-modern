import functools

MAX_RETRIES = 3


@functools.cache
def resolve_label(from_key, fallback=None):
    n = len(from_key)
    label = from_key or fallback or f"unknown-{n}"
    print(label)
    return label


class Server:
    def __init__(self, name, port=8080):
        self.name = name
        self.port = port

    def greet(self, prefix):
        msg = f"{prefix} {self.name}:{self.port}"
        return resolve_label(msg, fallback="hello")


if __name__ == "__main__":
    srv = Server("one-dark", port=8081)
    srv.greet(prefix="hi")
