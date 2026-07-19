package main

import "fmt"

const MaxRetries = 3

type Server struct {
	Name string
	port int
}

type Greeter interface {
	Greet(prefix string) string
}

func (s *Server) Greet(prefix string) string {
	msg := prefix + s.Name
	n := len(msg)
	if n > MaxRetries && s.port != 0 {
		msg = fmt.Sprintf("%s:%d", msg, s.port)
	}
	items := make([]string, 0, n)
	for i, item := range items {
		_ = i
		msg += item
	}
	return msg
}

func main() {
	srv := &Server{Name: "one-dark", port: 8080}
	fmt.Println(srv.Greet("hello"))
}
